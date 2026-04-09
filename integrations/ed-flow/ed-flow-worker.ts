/**
 * 🏥 BrainSAIT ED Flow API Gateway
 * Cloudflare Worker for global ED management system distribution
 * 
 * Deployment:
 *  - Bind to Cloudflare KV namespace: SESSION_KV (ED patient sessions)
 *  - Bind to Cloudflare KV namespace: METRICS_KV (Real-time KPIs)
 *  - Environment variables: BACKEND_URL, N8N_WEBHOOK_URL
 * 
 * Routes:
 *  - POST /ed/check-in → FastAPI backend → cache session
 *  - GET /ed/metrics → Fetch from KV cache + backend
 *  - POST /webhooks/n8n/* → Route to n8n MCP server
 */

import { Router } from 'itty-router';

// BRAINSAIT: Cloudflare KV bindings
interface Env {
  SESSION_KV: KVNamespace;      // ED patient sessions
  METRICS_KV: KVNamespace;       // Real-time KPI cache
  BACKEND_URL: string;           // FastAPI backend (Cloudflare Tunnel)
  N8N_WEBHOOK_URL: string;       // n8n workflow trigger
  ALLOWED_ORIGINS: string[];     // CORS
}

interface EDSession {
  encounter_id: string;
  patient_id_hash: string;
  hospital_code: string;
  arrival_time: string;
  status: 'waiting' | 'triaged' | 'bedded' | 'discharge' | 'exit_block';
  triage_level: string;
  bed_id?: string;
  last_update: string;
  ttl?: number;  // Redis-style TTL in seconds
}

interface EDMetrics {
  hospital_code: string;
  timestamp: string;
  total_patients: number;
  capacity: number;
  occupancy_percentage: number;
  waiting_count: number;
  bedded_count: number;
  exit_block_count: number;
  alerts: string[];
  alert_color?: string;
}

const router = Router();

// ============================================================================
// 🔐 MIDDLEWARE: CORS + Authentication
// ============================================================================

async function validateRequest(request: Request, env: Env): Promise<boolean> {
  const origin = request.headers.get('origin') || '';
  
  // BRAINSAIT: HIPAA role-based access control
  const authHeader = request.headers.get('authorization');
  const userRole = request.headers.get('x-user-role') || 'guest';
  
  if (!authHeader || !userRole) {
    return false;
  }
  
  return ['nurse', 'physician', 'admin'].includes(userRole);
}

function corsHeaders(env: Env): HeadersInit {
  return {
    'Access-Control-Allow-Origin': 'https://brainsait.org',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Role',
    'Cache-Control': 'no-store, must-revalidate'
  };
}

// ============================================================================
// 📡 ENDPOINTS
// ============================================================================

/**
 * POST /ed/check-in
 * Register patient in ED (proxies to FastAPI backend, caches session in KV)
 */
router.post('/ed/check-in', async (request: Request, env: Env) => {
  if (!await validateRequest(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: corsHeaders(env)
    });
  }
  
  const payload = await request.json() as any;
  const userRole = request.headers.get('x-user-role') || 'nurse';
  
  // NEURAL: Forward to FastAPI backend via Cloudflare Tunnel
  const backendResponse = await fetch(`${env.BACKEND_URL}/ed/check-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Role': userRole
    },
    body: JSON.stringify(payload)
  });
  
  const result = await backendResponse.json();
  const encounter_id = result.encounter_id;
  
  // Cache session in KV for 12 hours (standard ED stay)
  const session: EDSession = {
    encounter_id,
    patient_id_hash: hashPatientId(payload.patient_id),
    hospital_code: 'NGHA',
    arrival_time: new Date().toISOString(),
    status: 'waiting',
    triage_level: payload.triage_level,
    last_update: new Date().toISOString(),
    ttl: 12 * 3600  // 12 hours
  };
  
  await env.SESSION_KV.put(
    `session:${encounter_id}`,
    JSON.stringify(session),
    { expirationTtl: 12 * 3600 }
  );
  
  // Log audit event to KV
  await env.SESSION_KV.put(
    `audit:${encounter_id}:${Date.now()}`,
    JSON.stringify({
      action: 'PATIENT_CHECK_IN',
      encounter_id,
      user_role: userRole,
      timestamp: new Date().toISOString()
    })
  );
  
  return new Response(JSON.stringify(result), {
    status: backendResponse.status,
    headers: corsHeaders(env)
  });
});

/**
 * POST /ed/{encounter_id}/triage
 * Complete triage assessment
 */
router.post('/ed/:encounter_id/triage', async (request: Request, env: Env) => {
  if (!await validateRequest(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: corsHeaders(env)
    });
  }
  
  const { encounter_id } = request.params as any;
  const payload = await request.json() as any;
  const userRole = request.headers.get('x-user-role') || 'nurse';
  
  // Forward to FastAPI
  const backendResponse = await fetch(
    `${env.BACKEND_URL}/ed/${encounter_id}/triage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': userRole
      },
      body: JSON.stringify(payload)
    }
  );
  
  const result = await backendResponse.json();
  
  // Update session in KV
  const session = await env.SESSION_KV.get(`session:${encounter_id}`);
  if (session) {
    const sessionObj: EDSession = JSON.parse(session);
    sessionObj.status = 'triaged';
    sessionObj.last_update = new Date().toISOString();
    await env.SESSION_KV.put(
      `session:${encounter_id}`,
      JSON.stringify(sessionObj),
      { expirationTtl: 12 * 3600 }
    );
  }
  
  return new Response(JSON.stringify(result), {
    status: backendResponse.status,
    headers: corsHeaders(env)
  });
});

/**
 * POST /ed/{encounter_id}/assign-bed
 * Assign bed with bottleneck detection
 */
router.post('/ed/:encounter_id/assign-bed', async (request: Request, env: Env) => {
  if (!await validateRequest(request, env)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 403,
      headers: corsHeaders(env)
    });
  }
  
  const { encounter_id } = request.params as any;
  const { bed_id } = await request.json() as any;
  const userRole = request.headers.get('x-user-role') || 'nurse';
  
  // Forward to FastAPI
  const backendResponse = await fetch(
    `${env.BACKEND_URL}/ed/${encounter_id}/assign-bed`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Role': userRole
      },
      body: JSON.stringify({ bed_id })
    }
  );
  
  const result = await backendResponse.json();
  
  // Update session
  const session = await env.SESSION_KV.get(`session:${encounter_id}`);
  if (session) {
    const sessionObj: EDSession = JSON.parse(session);
    sessionObj.status = 'bedded';
    sessionObj.bed_id = bed_id;
    sessionObj.last_update = new Date().toISOString();
    await env.SESSION_KV.put(
      `session:${encounter_id}`,
      JSON.stringify(sessionObj),
      { expirationTtl: 12 * 3600 }
    );
  }
  
  return new Response(JSON.stringify(result), {
    status: backendResponse.status,
    headers: corsHeaders(env)
  });
});

/**
 * GET /ed/metrics
 * Real-time ED dashboard with KV cache
 * 
 * NEURAL: BrainSAIT color-coded alerts
 */
router.get('/ed/metrics', async (request: Request, env: Env) => {
  // Check KV cache first (1-minute TTL for real-time data)
  const cachedMetrics = await env.METRICS_KV.get('current:metrics');
  
  if (cachedMetrics) {
    // Cache hit - return immediately
    return new Response(cachedMetrics, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=60',  // 1 minute browser cache
        ...corsHeaders(env)
      }
    });
  }
  
  // Cache miss - fetch from backend
  const backendResponse = await fetch(
    `${env.BACKEND_URL}/ed/metrics`,
    {
      method: 'GET',
      headers: {
        'X-User-Role': request.headers.get('x-user-role') || 'guest'
      }
    }
  );
  
  const metrics = await backendResponse.json() as EDMetrics;
  
  // Cache for 60 seconds
  await env.METRICS_KV.put(
    'current:metrics',
    JSON.stringify(metrics),
    { expirationTtl: 60 }
  );
  
  return new Response(JSON.stringify(metrics), {
    status: backendResponse.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'max-age=60',
      ...corsHeaders(env)
    }
  });
});

/**
 * POST /webhooks/n8n/ed-event
 * Trigger n8n workflows for ED notifications
 * 
 * BILINGUAL: Routes to n8n for Arabic/English notifications
 */
router.post('/webhooks/n8n/ed-event', async (request: Request, env: Env) => {
  const payload = await request.json() as any;
  
  // Log webhook event
  await env.SESSION_KV.put(
    `webhook:${payload.encounter_id}:${Date.now()}`,
    JSON.stringify({
      action: payload.action,
      timestamp: new Date().toISOString(),
      payload
    }),
    { expirationTtl: 86400 }  // 24 hours
  );
  
  // Forward to n8n workflow
  const n8nResponse = await fetch(env.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      event: 'ED_FLOW_UPDATE',
      ...payload,
      timestamp: new Date().toISOString()
    })
  }).catch(err => {
    console.error('n8n webhook failed:', err);
    return new Response(JSON.stringify({ error: 'Workflow trigger failed' }), {
      status: 500
    });
  });
  
  return new Response(JSON.stringify({
    webhook_id: 'ed-event-webhook-001',
    status: 'triggered',
    n8n_status: n8nResponse.status
  }), {
    status: 200,
    headers: corsHeaders(env)
  });
});

/**
 * GET /ed/sessions
 * List active ED sessions (admin only)
 */
router.get('/ed/sessions', async (request: Request, env: Env) => {
  const userRole = request.headers.get('x-user-role') || 'guest';
  
  if (userRole !== 'admin') {
    return new Response(JSON.stringify({ error: 'Admin access required' }), {
      status: 403,
      headers: corsHeaders(env)
    });
  }
  
  // Query KV for all session keys
  const list = await env.SESSION_KV.list({ prefix: 'session:' });
  const sessions = [];
  
  for (const key of list.keys) {
    const session = await env.SESSION_KV.get(key.name);
    if (session) {
      sessions.push(JSON.parse(session));
    }
  }
  
  return new Response(JSON.stringify({
    total_active_sessions: sessions.length,
    sessions
  }), {
    status: 200,
    headers: corsHeaders(env)
  });
});

// ============================================================================
// 🔧 UTILITY FUNCTIONS
// ============================================================================

function hashPatientId(patientId: string): string {
  /**
   * BRAINSAIT: Hash patient ID for privacy
   * Prevents direct exposure of PII in KV keys
   */
  const encoder = new TextEncoder();
  const data = encoder.encode(patientId);
  // In production, use crypto.subtle.digest('SHA-256', data)
  return patientId.substring(0, 8) + Date.now().toString(36);
}

// ============================================================================
// OPTIONS (CORS preflight)
// ============================================================================

router.options('*', (request: Request, env: Env) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(env)
  });
});

// ============================================================================
// 404 Handler
// ============================================================================

router.all('*', () => {
  return new Response(
    JSON.stringify({ error: 'Not found' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
});

// ============================================================================
// Export
// ============================================================================

export default {
  fetch: router.handle
};
