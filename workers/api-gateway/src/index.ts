/**
 * HealthBridge API Gateway — Cloudflare Worker
 *
 * Responsibilities:
 *  - JWT authentication (tokens stored in SESSIONS_KV)
 *  - Per-facility rate limiting (counters in RATELIMIT_KV)
 *  - CORS handling
 *  - Reverse-proxy routing to downstream workers
 */

import { verifyJwt, signJwt, extractBearerToken, corsHeaders, errorResponse, jsonResponse } from '../../shared/auth';

export interface Env {
  SESSIONS_KV: KVNamespace;
  RATELIMIT_KV: KVNamespace;
  JWT_SECRET: string;
  NPHIES_PROXY_URL: string;
  DOCUMENT_STORE_URL: string;
  COMPLIANCE_DB_URL: string;
  RATE_LIMIT_REQUESTS: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
  ENVIRONMENT: string;
}


export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    // Health check
    if (url.pathname === '/api/health') {
      return jsonResponse({ status: 'ok', service: 'api-gateway', ts: Date.now() }, 200, origin);
    }

    // Auth token issuance
    if (url.pathname === '/api/auth/token' && request.method === 'POST') {
      return handleTokenRequest(request, env, origin);
    }

    // All other routes require a valid JWT
    const token = extractBearerToken(request);
    if (!token) {
      return errorResponse('Missing Authorization header', 401, origin);
    }

    const payload = await verifyJwt(token, env.JWT_SECRET);
    if (!payload) {
      return errorResponse('Invalid or expired token', 401, origin);
    }

    // Check session is still active in KV (allows server-side revocation)
    const sessionActive = await env.SESSIONS_KV.get(`session:${payload.sub}:${token.slice(-8)}`);
    if (!sessionActive) {
      return errorResponse('Session expired or revoked', 401, origin);
    }

    // Rate limiting per facility
    const rateError = await checkRateLimit(env, payload.facilityId);
    if (rateError) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': env.RATE_LIMIT_WINDOW_SECONDS,
          ...corsHeaders(origin),
        },
      });
    }

    // Route to downstream workers
    return routeRequest(request, env, url, payload.facilityId, origin);
  },
};

/** Issue a JWT and store session reference in KV */
async function handleTokenRequest(request: Request, env: Env, origin: string | null): Promise<Response> {
  let body: { facilityId?: string; apiKey?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400, origin);
  }

  const { facilityId, apiKey, role = 'clinician' } = body;
  if (!facilityId || !apiKey) {
    return errorResponse('facilityId and apiKey are required', 400, origin);
  }

  // Validate API key from KV (facilities register their keys during onboarding)
  const storedKey = await env.SESSIONS_KV.get(`apikey:${facilityId}`);
  if (!storedKey || storedKey !== apiKey) {
    return errorResponse('Invalid facility credentials', 401, origin);
  }

  const token = await signJwt({ sub: facilityId, role, facilityId }, env.JWT_SECRET, 3600);
  const suffix = token.slice(-8);

  // Store session reference (TTL matches token expiry)
  await env.SESSIONS_KV.put(`session:${facilityId}:${suffix}`, '1', { expirationTtl: 3600 });

  return jsonResponse({ token, expiresIn: 3600, tokenType: 'Bearer' }, 200, origin);
}

/** Per-facility sliding window rate limiter using KV */
async function checkRateLimit(env: Env, facilityId: string): Promise<boolean> {
  const maxRequests = parseInt(env.RATE_LIMIT_REQUESTS, 10) || 100;
  const windowSec = parseInt(env.RATE_LIMIT_WINDOW_SECONDS, 10) || 60;
  const key = `rl:${facilityId}:${Math.floor(Date.now() / (windowSec * 1000))}`;

  const current = await env.RATELIMIT_KV.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= maxRequests) return true;

  await env.RATELIMIT_KV.put(key, String(count + 1), { expirationTtl: windowSec * 2 });
  return false;
}

/** Route request to the appropriate downstream worker */
async function routeRequest(
  request: Request,
  env: Env,
  url: URL,
  facilityId: string,
  origin: string | null
): Promise<Response> {
  const path = url.pathname;
  let targetBase: string;

  if (path.startsWith('/api/nphies/')) {
    targetBase = env.NPHIES_PROXY_URL;
  } else if (path.startsWith('/api/documents/')) {
    targetBase = env.DOCUMENT_STORE_URL;
  } else if (path.startsWith('/api/compliance/')) {
    targetBase = env.COMPLIANCE_DB_URL;
  } else {
    return errorResponse(`No route for ${path}`, 404, origin);
  }

  // Forward the request, injecting the verified facility ID header
  const targetUrl = `${targetBase}${path}${url.search}`;
  const headers = new Headers(request.headers);
  headers.set('X-Facility-Id', facilityId);
  headers.delete('Authorization'); // Don't forward the client JWT downstream

  const upstream = new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
  });

  try {
    const response = await fetch(upstream);
    // Re-apply CORS headers on the downstream response
    const newHeaders = new Headers(response.headers);
    Object.entries(corsHeaders(origin)).forEach(([k, v]) => newHeaders.set(k, v));
    return new Response(response.body, { status: response.status, headers: newHeaders });
  } catch (err) {
    return errorResponse('Upstream service unavailable', 502, origin);
  }
}
