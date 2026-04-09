/**
 * HealthBridge NPHIES Proxy — Cloudflare Worker
 *
 * Responsibilities:
 *  - Proxy FHIR R4 requests to NPHIES sandbox/production
 *  - Cache eligibility (CoverageEligibilityRequest) responses in KV for 5 minutes
 *  - Cache claim status responses in KV for 60 seconds
 *  - Inject facility-level NPHIES credentials (stored as secrets)
 */

import { corsHeaders, errorResponse, jsonResponse } from '../../shared/auth';

export interface Env {
  NPHIES_CACHE_KV: KVNamespace;
  NPHIES_BASE_URL: string;
  NPHIES_CLIENT_ID: string;     // set via: wrangler secret put NPHIES_CLIENT_ID
  NPHIES_CLIENT_SECRET: string; // set via: wrangler secret put NPHIES_CLIENT_SECRET
  ELIGIBILITY_CACHE_TTL_SECONDS: string;
  CLAIM_STATUS_CACHE_TTL_SECONDS: string;
  ENVIRONMENT: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const facilityId = request.headers.get('X-Facility-Id') ?? 'unknown';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === '/api/health') {
      return jsonResponse({ status: 'ok', service: 'nphies-proxy' }, 200, origin);
    }

    const path = url.pathname;

    // Eligibility check — GET /api/nphies/eligibility/:memberId
    if (path.startsWith('/api/nphies/eligibility/') && request.method === 'GET') {
      return handleEligibility(request, env, url, facilityId, origin);
    }

    // Claim submission — POST /api/nphies/claims
    if (path === '/api/nphies/claims' && request.method === 'POST') {
      return handleClaimSubmission(request, env, facilityId, origin);
    }

    // Claim status — GET /api/nphies/claims/:claimId/status
    if (path.match(/^\/api\/nphies\/claims\/[^/]+\/status$/) && request.method === 'GET') {
      return handleClaimStatus(request, env, url, facilityId, origin);
    }

    // Pre-authorization — POST /api/nphies/preauth
    if (path === '/api/nphies/preauth' && request.method === 'POST') {
      return handlePreauth(request, env, facilityId, origin);
    }

    return errorResponse(`Unknown NPHIES route: ${path}`, 404, origin);
  },
};

/** Eligibility check with KV caching */
async function handleEligibility(
  _request: Request,
  env: Env,
  url: URL,
  facilityId: string,
  origin: string | null
): Promise<Response> {
  const memberId = url.pathname.split('/').pop() ?? '';
  if (!memberId) return errorResponse('memberId is required', 400, origin);

  const insurerId = url.searchParams.get('insurerId') ?? '';
  const cacheKey = `eligibility:${facilityId}:${memberId}:${insurerId}`;
  const ttl = parseInt(env.ELIGIBILITY_CACHE_TTL_SECONDS, 10) || 300;

  // Check KV cache first
  const cached = await env.NPHIES_CACHE_KV.get(cacheKey, 'json');
  if (cached) {
    return jsonResponse({ ...cached as object, cached: true, cacheKey }, 200, origin);
  }

  // Build FHIR CoverageEligibilityRequest bundle
  const fhirBundle = buildEligibilityBundle(memberId, insurerId, facilityId);

  const nphiesResponse = await callNphies(
    env,
    '/fhir/$process-message',
    'POST',
    fhirBundle
  );

  if (!nphiesResponse.ok) {
    const errText = await nphiesResponse.text();
    return errorResponse(`NPHIES error: ${errText}`, nphiesResponse.status, origin);
  }

  const result = await nphiesResponse.json() as Record<string, unknown>;
  const parsed = parseEligibilityResponse(result);

  // Store in KV with TTL
  await env.NPHIES_CACHE_KV.put(cacheKey, JSON.stringify(parsed), { expirationTtl: ttl });

  return jsonResponse({ ...parsed, cached: false }, 200, origin);
}

/** Submit a FHIR claim bundle to NPHIES */
async function handleClaimSubmission(
  request: Request,
  env: Env,
  _facilityId: string,
  origin: string | null
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, origin);
  }

  // Validate minimum FHIR bundle structure
  if (body.resourceType !== 'Bundle') {
    return errorResponse('Request body must be a FHIR Bundle', 400, origin);
  }

  const nphiesResponse = await callNphies(env, '/fhir/$process-message', 'POST', body);

  if (!nphiesResponse.ok) {
    const errText = await nphiesResponse.text();
    return errorResponse(`NPHIES claim rejection: ${errText}`, nphiesResponse.status, origin);
  }

  const result = await nphiesResponse.json() as Record<string, unknown>;
  return jsonResponse(result, 201, origin);
}

/** Get claim status with short KV cache */
async function handleClaimStatus(
  _request: Request,
  env: Env,
  url: URL,
  facilityId: string,
  origin: string | null
): Promise<Response> {
  const parts = url.pathname.split('/');
  const claimId = parts[parts.length - 2];
  const cacheKey = `claimstatus:${facilityId}:${claimId}`;
  const ttl = parseInt(env.CLAIM_STATUS_CACHE_TTL_SECONDS, 10) || 60;

  const cached = await env.NPHIES_CACHE_KV.get(cacheKey, 'json');
  if (cached) {
    return jsonResponse({ ...cached as object, cached: true }, 200, origin);
  }

  const nphiesResponse = await callNphies(env, `/fhir/Claim/${claimId}`, 'GET', null);
  if (!nphiesResponse.ok) {
    return errorResponse(`Claim not found: ${claimId}`, nphiesResponse.status, origin);
  }

  const result = await nphiesResponse.json() as Record<string, unknown>;
  await env.NPHIES_CACHE_KV.put(cacheKey, JSON.stringify(result), { expirationTtl: ttl });

  return jsonResponse({ ...result, cached: false }, 200, origin);
}

/** Submit a pre-authorization request */
async function handlePreauth(
  request: Request,
  env: Env,
  _facilityId: string,
  origin: string | null
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, origin);
  }

  const nphiesResponse = await callNphies(env, '/fhir/$process-message', 'POST', body);
  if (!nphiesResponse.ok) {
    const errText = await nphiesResponse.text();
    return errorResponse(`NPHIES preauth error: ${errText}`, nphiesResponse.status, origin);
  }

  const result = await nphiesResponse.json();
  return jsonResponse(result, 201, origin);
}

/** Low-level NPHIES API caller */
async function callNphies(
  env: Env,
  path: string,
  method: string,
  body: unknown
): Promise<Response> {
  const url = `${env.NPHIES_BASE_URL}${path}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/fhir+json',
    'Accept': 'application/fhir+json',
  };

  // Use client credentials if available (sandbox uses open access)
  if (env.NPHIES_CLIENT_ID && env.NPHIES_CLIENT_SECRET) {
    const creds = btoa(`${env.NPHIES_CLIENT_ID}:${env.NPHIES_CLIENT_SECRET}`);
    headers['Authorization'] = `Basic ${creds}`;
  }

  return fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** Build a minimal FHIR CoverageEligibilityRequest bundle */
function buildEligibilityBundle(memberId: string, insurerId: string, facilityId: string): object {
  const requestId = crypto.randomUUID();
  return {
    resourceType: 'Bundle',
    id: requestId,
    type: 'message',
    timestamp: new Date().toISOString(),
    entry: [
      {
        fullUrl: `urn:uuid:${requestId}`,
        resource: {
          resourceType: 'MessageHeader',
          id: requestId,
          eventCoding: {
            system: 'http://nphies.sa/terminology/CodeSystem/ksa-message-events',
            code: 'eligibility-request',
          },
          source: { endpoint: `https://healthbridge.sa/facilities/${facilityId}` },
          focus: [{ reference: `urn:uuid:er-${requestId}` }],
        },
      },
      {
        fullUrl: `urn:uuid:er-${requestId}`,
        resource: {
          resourceType: 'CoverageEligibilityRequest',
          id: `er-${requestId}`,
          status: 'active',
          purpose: ['benefits'],
          patient: { reference: `urn:uuid:pat-${memberId}` },
          created: new Date().toISOString().split('T')[0],
          insurer: { identifier: { system: 'http://nphies.sa/license/payer-license', value: insurerId } },
          insurance: [{ coverage: { reference: `urn:uuid:cov-${memberId}` } }],
        },
      },
    ],
  };
}

/** Parse NPHIES eligibility response into a clean object */
function parseEligibilityResponse(bundle: Record<string, unknown>): object {
  // Minimal parsing — real implementation should traverse the FHIR bundle
  const entries = (bundle.entry as Array<Record<string, unknown>>) ?? [];
  const eligibilityResponse = entries.find(
    (e) => (e.resource as Record<string, unknown>)?.resourceType === 'CoverageEligibilityResponse'
  );
  const resource = (eligibilityResponse?.resource as Record<string, unknown>) ?? {};
  return {
    eligible: resource.outcome === 'complete',
    outcome: resource.outcome,
    status: resource.status,
    raw: bundle,
  };
}
