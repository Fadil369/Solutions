import { extractBearerToken, verifyJwt } from '../../shared/auth';

export interface Env {
  SESSION_KV: KVNamespace;
  METRICS_KV: KVNamespace;
  JWT_SECRET: string;
  BACKEND_URL: string;
  N8N_WEBHOOK_URL: string;
  ALLOWED_ORIGINS?: string;
  DEFAULT_HOSPITAL_CODE?: string;
  ENVIRONMENT?: string;
}

interface EDSession {
  encounter_id: string;
  patient_id_hash: string;
  hospital_code: string;
  arrival_time: string;
  status: 'waiting' | 'triaged' | 'bedded' | 'discharge' | 'exit_block';
  triage_level?: string;
  bed_id?: string;
  last_update: string;
}

const SESSION_TTL_SECONDS = 12 * 60 * 60;
const METRICS_TTL_SECONDS = 60;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: buildCorsHeaders(request, env) });
    }

    if (request.method === 'GET' && url.pathname === '/ed/health') {
      return jsonResponse(
        {
          status: 'ok',
          service: 'ed-flow',
          environment: env.ENVIRONMENT ?? 'production',
          timestamp: new Date().toISOString(),
        },
        request,
        env,
      );
    }

    if (request.method === 'POST' && url.pathname === '/ed/check-in') {
      return handleCheckIn(request, env);
    }

    if (request.method === 'POST' && /^\/ed\/[^/]+\/triage$/.test(url.pathname)) {
      const encounterId = url.pathname.split('/')[2];
      return handleEncounterUpdate(request, env, encounterId, 'triaged');
    }

    if (request.method === 'POST' && /^\/ed\/[^/]+\/assign-bed$/.test(url.pathname)) {
      const encounterId = url.pathname.split('/')[2];
      return handleEncounterUpdate(request, env, encounterId, 'bedded');
    }

    if (request.method === 'GET' && url.pathname === '/ed/metrics') {
      return handleMetrics(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/ed/sessions') {
      return handleSessions(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/webhooks/n8n/ed-event') {
      return handleWebhook(request, env);
    }

    return jsonError('Not found', 404, request, env);
  },
};

async function handleCheckIn(request: Request, env: Env): Promise<Response> {
  const role = await requireAuthorizedRole(request, env);
  if (!role) {
    return jsonError('Unauthorized', 403, request, env);
  }

  const payload = await parseJson<Record<string, unknown>>(request);
  if (!payload || typeof payload.patient_id !== 'string') {
    return jsonError('patient_id is required', 400, request, env);
  }

  const backendResponse = await proxyJson(
    `${trimTrailingSlash(env.BACKEND_URL)}/ed/check-in`,
    payload,
    request,
    role,
  );

  if (!backendResponse.ok) {
    return forwardBackendResponse(backendResponse, request, env);
  }

  const result = await backendResponse.json<Record<string, unknown>>();
  const encounterId = typeof result.encounter_id === 'string' ? result.encounter_id : null;

  if (!encounterId) {
    return jsonError('Backend did not return encounter_id', 502, request, env);
  }

  const hospitalCode =
    typeof payload.hospital_code === 'string' ? payload.hospital_code : env.DEFAULT_HOSPITAL_CODE;
  if (!hospitalCode) {
    return jsonError('hospital_code is required when DEFAULT_HOSPITAL_CODE is not configured', 400, request, env);
  }

  const session: EDSession = {
    encounter_id: encounterId,
    patient_id_hash: await hashPatientId(payload.patient_id, env.JWT_SECRET),
    hospital_code: hospitalCode,
    arrival_time: new Date().toISOString(),
    status: 'waiting',
    triage_level: typeof payload.triage_level === 'string' ? payload.triage_level : undefined,
    last_update: new Date().toISOString(),
  };

  await env.SESSION_KV.put(`session:${encounterId}`, JSON.stringify(session), {
    expirationTtl: SESSION_TTL_SECONDS,
  });

  await recordEvent(env, `audit:${encounterId}:${Date.now()}`, {
    action: 'PATIENT_CHECK_IN',
    encounter_id: encounterId,
    user_role: role,
    timestamp: new Date().toISOString(),
  });

  return jsonResponse(result, request, env, backendResponse.status);
}

async function handleEncounterUpdate(
  request: Request,
  env: Env,
  encounterId: string,
  status: EDSession['status'],
): Promise<Response> {
  const role = await requireAuthorizedRole(request, env);
  if (!role) {
    return jsonError('Unauthorized', 403, request, env);
  }

  const payload = await parseJson<Record<string, unknown>>(request);
  if (!payload) {
    return jsonError('Invalid JSON body', 400, request, env);
  }

  const action = status === 'bedded' ? 'assign-bed' : 'triage';
  const backendResponse = await proxyJson(
    `${trimTrailingSlash(env.BACKEND_URL)}/ed/${encounterId}/${action}`,
    payload,
    request,
    role,
  );

  const backendBody = await readBackendBody(backendResponse);
  if (!backendResponse.ok) {
    return jsonResponse(backendBody, request, env, backendResponse.status);
  }

  const storedSession = await env.SESSION_KV.get(`session:${encounterId}`);
  if (storedSession) {
    const session = JSON.parse(storedSession) as EDSession;
    session.status = status;
    session.last_update = new Date().toISOString();
    if (status === 'bedded' && typeof payload.bed_id === 'string') {
      session.bed_id = payload.bed_id;
    }
    await env.SESSION_KV.put(`session:${encounterId}`, JSON.stringify(session), {
      expirationTtl: SESSION_TTL_SECONDS,
    });
  }

  return jsonResponse(backendBody, request, env, backendResponse.status);
}

async function handleMetrics(request: Request, env: Env): Promise<Response> {
  const role = await requireAuthorizedRole(request, env);
  if (!role) {
    return jsonError('Unauthorized', 403, request, env);
  }

  const cached = await env.METRICS_KV.get('current:metrics');
  if (cached) {
    return new Response(cached, {
      status: 200,
      headers: {
        ...buildCorsHeaders(request, env),
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${METRICS_TTL_SECONDS}`,
      },
    });
  }

  const backendResponse = await fetch(`${trimTrailingSlash(env.BACKEND_URL)}/ed/metrics`, {
    headers: {
      Authorization: request.headers.get('authorization') ?? '',
      'X-User-Role': role,
    },
  });

  const backendBody = await readBackendBody(backendResponse);
  if (!backendResponse.ok) {
    return jsonResponse(backendBody, request, env, backendResponse.status);
  }

  await env.METRICS_KV.put('current:metrics', JSON.stringify(backendBody), {
    expirationTtl: METRICS_TTL_SECONDS,
  });

  return jsonResponse(backendBody, request, env, backendResponse.status, {
    'Cache-Control': `max-age=${METRICS_TTL_SECONDS}`,
  });
}

async function handleSessions(request: Request, env: Env): Promise<Response> {
  const role = await requireAuthorizedRole(request, env);
  if (role !== 'admin') {
    return jsonError('Admin access required', 403, request, env);
  }

  const sessionList = await env.SESSION_KV.list({ prefix: 'session:' });
  const sessions = await Promise.all(
    sessionList.keys.map(async (key) => {
      const value = await env.SESSION_KV.get(key.name);
      return value ? (JSON.parse(value) as EDSession) : null;
    }),
  );

  return jsonResponse(
    {
      total_active_sessions: sessions.filter(Boolean).length,
      sessions: sessions.filter(Boolean),
    },
    request,
    env,
  );
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const role = await requireAuthorizedRole(request, env);
  if (!role) {
    return jsonError('Unauthorized', 403, request, env);
  }

  const payload = await parseJson<Record<string, unknown>>(request);
  if (!payload) {
    return jsonError('Invalid JSON body', 400, request, env);
  }

  await recordEvent(env, `webhook:${String(payload.encounter_id ?? 'unknown')}:${Date.now()}`, {
    action: payload.action ?? 'UNKNOWN',
    timestamp: new Date().toISOString(),
    payload,
  });

  const n8nResponse = await fetch(env.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'ED_FLOW_UPDATE',
      ...payload,
      forwarded_at: new Date().toISOString(),
      forwarded_by_role: role,
    }),
  });

  if (!n8nResponse.ok) {
    return jsonError('Workflow trigger failed', 502, request, env);
  }

  return jsonResponse(
    {
      status: 'triggered',
      upstream_status: n8nResponse.status,
    },
    request,
    env,
  );
}

async function requireAuthorizedRole(
  request: Request,
  env: Env,
): Promise<'nurse' | 'physician' | 'admin' | null> {
  const roleHeader = request.headers.get('x-user-role');
  const role =
    roleHeader === 'nurse' || roleHeader === 'physician' || roleHeader === 'admin'
      ? roleHeader
      : null;

  const token = extractBearerToken(request);
  if (!token || !role) {
    return null;
  }

  const payload = await verifyJwt(token, env.JWT_SECRET);
  if (!payload) {
    return null;
  }

  if (role === 'admin') {
    return payload.role === 'admin' ? 'admin' : null;
  }

  return payload.role === 'admin' || payload.role === 'clinician' ? role : null;
}

async function proxyJson(
  url: string,
  payload: Record<string, unknown>,
  request: Request,
  role: string,
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: request.headers.get('authorization') ?? '',
      'X-User-Role': role,
    },
    body: JSON.stringify(payload),
  });
}

function buildCorsHeaders(request: Request, env: Env): HeadersInit {
  const origin = request.headers.get('Origin');
  const allowedOrigins = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry && !entry.startsWith('REPLACE_WITH_'));
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0] ?? origin ?? '*';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Role',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(
  payload: unknown,
  request: Request,
  env: Env,
  status = 200,
  extraHeaders: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...buildCorsHeaders(request, env),
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

function jsonError(message: string, status: number, request: Request, env: Env): Response {
  return jsonResponse({ error: message }, request, env, status);
}

async function parseJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

async function readBackendBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return { status: response.status, text: await response.text() };
  }
}

async function forwardBackendResponse(response: Response, request: Request, env: Env): Promise<Response> {
  const body = await readBackendBody(response);
  return jsonResponse(body, request, env, response.status);
}

async function recordEvent(env: Env, key: string, payload: unknown): Promise<void> {
  await env.SESSION_KV.put(key, JSON.stringify(payload), { expirationTtl: 24 * 60 * 60 });
}

async function hashPatientId(patientId: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(patientId));
  return Array.from(new Uint8Array(signature))
    .slice(0, 12)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
