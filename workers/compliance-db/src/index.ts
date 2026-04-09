/**
 * HealthBridge Compliance DB — Cloudflare Worker
 *
 * D1 SQLite-backed REST API for CBAHI compliance tracking.
 *
 * Endpoints:
 *   GET  /api/compliance/facilities                        — list facilities
 *   POST /api/compliance/facilities                        — create facility
 *   GET  /api/compliance/facilities/:id                    — get facility
 *
 *   GET  /api/compliance/findings/:facilityId              — list findings
 *   POST /api/compliance/findings                          — create finding
 *   PUT  /api/compliance/findings/:id                      — update finding
 *   DELETE /api/compliance/findings/:id                    — delete finding
 *
 *   GET  /api/compliance/claims/:facilityId                — list claims
 *   POST /api/compliance/claims                            — record claim
 *   PUT  /api/compliance/claims/:id/status                 — update claim status
 *
 *   GET  /api/compliance/readiness/:facilityId             — readiness score
 *   POST /api/compliance/audit                             — write audit entry
 *   GET  /api/compliance/audit/:facilityId                 — read audit log
 *
 *   GET  /api/health                                       — health check
 */

import { corsHeaders, errorResponse, jsonResponse } from '../../shared/auth';

export interface Env {
  COMPLIANCE_DB: D1Database;
  PAGE_SIZE: string;
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/api/health') {
      return jsonResponse({ status: 'ok', service: 'compliance-db' }, 200, origin);
    }

    try {
      return await route(request, env, url, origin);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      return errorResponse(message, 500, origin);
    }
  },
};

async function route(request: Request, env: Env, url: URL, origin: string | null): Promise<Response> {
  const path = url.pathname;
  const method = request.method;
  const pageSize = parseInt(env.PAGE_SIZE, 10) || 50;

  // ── Facilities ─────────────────────────────────────────────────
  if (path === '/api/compliance/facilities' && method === 'GET') {
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const offset = (page - 1) * pageSize;
    const { results } = await env.COMPLIANCE_DB
      .prepare('SELECT * FROM facilities ORDER BY name LIMIT ? OFFSET ?')
      .bind(pageSize, offset)
      .all();
    return jsonResponse({ page, pageSize, count: results.length, facilities: results }, 200, origin);
  }

  if (path === '/api/compliance/facilities' && method === 'POST') {
    const body = await parseBody<FacilityInput>(request, origin);
    if (body instanceof Response) return body;

    const id = body.id ?? crypto.randomUUID();
    await env.COMPLIANCE_DB
      .prepare(`INSERT INTO facilities (id, name, name_ar, license_no, region, bed_count, cbahi_status, nphies_code)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, body.name, body.name_ar ?? null, body.license_no ?? null, body.region ?? null,
            body.bed_count ?? null, body.cbahi_status ?? 'Unknown', body.nphies_code ?? null)
      .run();

    await writeAudit(env, id, 'CREATE', 'facilities', id, request);
    return jsonResponse({ id, ...body }, 201, origin);
  }

  const facilityMatch = path.match(/^\/api\/compliance\/facilities\/([^/]+)$/);
  if (facilityMatch && method === 'GET') {
    const { results } = await env.COMPLIANCE_DB
      .prepare('SELECT * FROM facilities WHERE id = ?')
      .bind(facilityMatch[1])
      .all();
    if (!results.length) return errorResponse('Facility not found', 404, origin);
    return jsonResponse(results[0], 200, origin);
  }

  // ── Findings ───────────────────────────────────────────────────
  const findingsFacilityMatch = path.match(/^\/api\/compliance\/findings\/([^/]+)$/);
  if (findingsFacilityMatch && method === 'GET') {
    const facilityId = findingsFacilityMatch[1];
    const status = url.searchParams.get('status');
    const domain = url.searchParams.get('domain');
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const offset = (page - 1) * pageSize;

    let query = 'SELECT * FROM cbahi_findings WHERE facility_id = ?';
    const params: (string | number)[] = [facilityId];
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (domain) { query += ' AND domain = ?'; params.push(domain); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const { results } = await env.COMPLIANCE_DB.prepare(query).bind(...params).all();
    return jsonResponse({ facilityId, page, pageSize, count: results.length, findings: results }, 200, origin);
  }

  if (path === '/api/compliance/findings' && method === 'POST') {
    const body = await parseBody<FindingInput>(request, origin);
    if (body instanceof Response) return body;

    if (!body.facility_id || !body.standard_code || !body.domain || !body.description) {
      return errorResponse('facility_id, standard_code, domain, description are required', 400, origin);
    }

    const id = crypto.randomUUID();
    await env.COMPLIANCE_DB
      .prepare(`INSERT INTO cbahi_findings (id, facility_id, standard_code, domain, description, severity, status, assignee, evidence_key, due_date, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, body.facility_id, body.standard_code, body.domain, body.description,
            body.severity ?? 'Major', body.status ?? 'Open', body.assignee ?? null,
            body.evidence_key ?? null, body.due_date ?? null, body.notes ?? null)
      .run();

    await writeAudit(env, body.facility_id, 'CREATE', 'findings', id, request);
    return jsonResponse({ id, ...body }, 201, origin);
  }

  const findingIdMatch = path.match(/^\/api\/compliance\/findings\/([^/]+)$/);
  if (findingIdMatch && method === 'PUT') {
    const id = findingIdMatch[1];
    const body = await parseBody<Partial<FindingInput>>(request, origin);
    if (body instanceof Response) return body;

    const updates: string[] = [];
    const params: (string | number | null)[] = [];
    const allowed = ['status', 'assignee', 'evidence_key', 'due_date', 'notes', 'resolved_at', 'severity'] as const;
    for (const key of allowed) {
      if (key in body) { updates.push(`${key} = ?`); params.push((body as Record<string, string | null>)[key] ?? null); }
    }
    if (!updates.length) return errorResponse('No fields to update', 400, origin);
    updates.push("updated_at = datetime('now')");
    params.push(id);

    const result = await env.COMPLIANCE_DB
      .prepare(`UPDATE cbahi_findings SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...params)
      .run();

    if (!result.meta.changes) return errorResponse('Finding not found', 404, origin);
    await writeAudit(env, null, 'UPDATE', 'findings', id, request);
    return jsonResponse({ id, updated: true }, 200, origin);
  }

  if (findingIdMatch && method === 'DELETE') {
    const id = findingIdMatch[1];
    const result = await env.COMPLIANCE_DB
      .prepare('DELETE FROM cbahi_findings WHERE id = ?').bind(id).run();
    if (!result.meta.changes) return errorResponse('Finding not found', 404, origin);
    await writeAudit(env, null, 'DELETE', 'findings', id, request);
    return jsonResponse({ id, deleted: true }, 200, origin);
  }

  // ── Claims ─────────────────────────────────────────────────────
  const claimsFacilityMatch = path.match(/^\/api\/compliance\/claims\/([^/]+)$/);
  if (claimsFacilityMatch && method === 'GET') {
    const facilityId = claimsFacilityMatch[1];
    const status = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const offset = (page - 1) * pageSize;

    let query = 'SELECT * FROM claim_records WHERE facility_id = ?';
    const params: (string | number)[] = [facilityId];
    if (status) { query += ' AND status = ?'; params.push(status); }
    query += ' ORDER BY submitted_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize, offset);

    const { results } = await env.COMPLIANCE_DB.prepare(query).bind(...params).all();
    return jsonResponse({ facilityId, page, pageSize, count: results.length, claims: results }, 200, origin);
  }

  if (path === '/api/compliance/claims' && method === 'POST') {
    const body = await parseBody<ClaimInput>(request, origin);
    if (body instanceof Response) return body;

    if (!body.facility_id) return errorResponse('facility_id is required', 400, origin);
    const id = crypto.randomUUID();
    await env.COMPLIANCE_DB
      .prepare(`INSERT INTO claim_records (id, facility_id, nphies_ref, patient_id, insurer_code, claim_type, total_amount, currency, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, body.facility_id, body.nphies_ref ?? null, body.patient_id ?? null,
            body.insurer_code ?? null, body.claim_type ?? null, body.total_amount ?? null,
            body.currency ?? 'SAR', body.status ?? 'submitted')
      .run();

    await writeAudit(env, body.facility_id, 'CREATE', 'claims', id, request);
    return jsonResponse({ id, ...body }, 201, origin);
  }

  const claimStatusMatch = path.match(/^\/api\/compliance\/claims\/([^/]+)\/status$/);
  if (claimStatusMatch && method === 'PUT') {
    const id = claimStatusMatch[1];
    const body = await parseBody<{ status: string; rejection_code?: string; rejection_reason?: string }>(request, origin);
    if (body instanceof Response) return body;
    if (!body.status) return errorResponse('status is required', 400, origin);

    const result = await env.COMPLIANCE_DB
      .prepare(`UPDATE claim_records SET status = ?, rejection_code = ?, rejection_reason = ?, updated_at = datetime('now') WHERE id = ?`)
      .bind(body.status, body.rejection_code ?? null, body.rejection_reason ?? null, id)
      .run();

    if (!result.meta.changes) return errorResponse('Claim not found', 404, origin);
    return jsonResponse({ id, status: body.status, updated: true }, 200, origin);
  }

  // ── Readiness Score ────────────────────────────────────────────
  const readinessMatch = path.match(/^\/api\/compliance\/readiness\/([^/]+)$/);
  if (readinessMatch && method === 'GET') {
    return computeReadiness(env, readinessMatch[1], origin);
  }

  // ── Audit Log ──────────────────────────────────────────────────
  if (path === '/api/compliance/audit' && method === 'POST') {
    const body = await parseBody<AuditInput>(request, origin);
    if (body instanceof Response) return body;
    await env.COMPLIANCE_DB
      .prepare('INSERT INTO audit_log (facility_id, action, resource, resource_id, actor, ip_address, details) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(body.facility_id ?? null, body.action, body.resource ?? null, body.resource_id ?? null,
            body.actor ?? 'api', body.ip_address ?? null, body.details ? JSON.stringify(body.details) : null)
      .run();
    return jsonResponse({ logged: true }, 201, origin);
  }

  const auditFacilityMatch = path.match(/^\/api\/compliance\/audit\/([^/]+)$/);
  if (auditFacilityMatch && method === 'GET') {
    const facilityId = auditFacilityMatch[1];
    const page = parseInt(url.searchParams.get('page') ?? '1', 10);
    const offset = (page - 1) * pageSize;
    const { results } = await env.COMPLIANCE_DB
      .prepare('SELECT * FROM audit_log WHERE facility_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?')
      .bind(facilityId, pageSize, offset)
      .all();
    return jsonResponse({ facilityId, page, pageSize, count: results.length, entries: results }, 200, origin);
  }

  return errorResponse(`No route for ${method} ${path}`, 404, origin);
}

async function computeReadiness(env: Env, facilityId: string, origin: string | null): Promise<Response> {
  const { results } = await env.COMPLIANCE_DB
    .prepare(`SELECT status, severity, COUNT(*) as cnt FROM cbahi_findings WHERE facility_id = ? GROUP BY status, severity`)
    .bind(facilityId)
    .all() as { results: Array<{ status: string; severity: string; cnt: number }> };

  let total = 0, resolved = 0, criticalOpen = 0;
  for (const row of results) {
    total += row.cnt;
    if (row.status === 'Resolved' || row.status === 'Verified') resolved += row.cnt;
    if ((row.status === 'Open' || row.status === 'In-Progress') && row.severity === 'Critical') criticalOpen += row.cnt;
  }

  const pending = total - resolved;
  const score = total === 0 ? 100 : Math.round((resolved / total) * 100);
  const predictedStatus = criticalOpen > 0 ? 'Denial' : score >= 85 ? 'Accredited' : score >= 60 ? 'Conditional' : 'Denial';

  // Upsert latest score
  const scoreId = crypto.randomUUID();
  await env.COMPLIANCE_DB
    .prepare(`INSERT INTO readiness_scores (id, facility_id, score, total_findings, resolved, pending, critical_open, predicted_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(scoreId, facilityId, score, total, resolved, pending, criticalOpen, predictedStatus)
    .run();

  return jsonResponse({ facilityId, score, total, resolved, pending, criticalOpen, predictedStatus, calculatedAt: new Date().toISOString() }, 200, origin);
}

async function writeAudit(env: Env, facilityId: string | null, action: string, resource: string, resourceId: string, request: Request): Promise<void> {
  const actor = request.headers.get('X-Facility-Id') ?? 'system';
  await env.COMPLIANCE_DB
    .prepare('INSERT INTO audit_log (facility_id, action, resource, resource_id, actor) VALUES (?, ?, ?, ?, ?)')
    .bind(facilityId, action, resource, resourceId, actor)
    .run();
}

async function parseBody<T>(request: Request, origin: string | null): Promise<T | Response> {
  try {
    return await request.json() as T;
  } catch {
    return errorResponse('Invalid JSON body', 400, origin);
  }
}

// ── Input types ─────────────────────────────────────────────────
interface FacilityInput {
  id?: string; name: string; name_ar?: string; license_no?: string;
  region?: string; bed_count?: number; cbahi_status?: string; nphies_code?: string;
}
interface FindingInput {
  facility_id: string; standard_code: string; domain: string; description: string;
  severity?: string; status?: string; assignee?: string; evidence_key?: string;
  due_date?: string; notes?: string; resolved_at?: string;
}
interface ClaimInput {
  facility_id: string; nphies_ref?: string; patient_id?: string; insurer_code?: string;
  claim_type?: string; total_amount?: number; currency?: string; status?: string;
}
interface AuditInput {
  facility_id?: string; action: string; resource?: string; resource_id?: string;
  actor?: string; ip_address?: string; details?: unknown;
}
