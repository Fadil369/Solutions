# HealthBridge Cloudflare Workers

Four Cloudflare Workers providing edge API services for the HealthBridge KSA platform.

## Workers Overview

| Worker | Port (local) | Bindings | Purpose |
|--------|-------------|----------|---------|
| `api-gateway` | 8787 | KV: SESSIONS_KV, RATELIMIT_KV | Auth, rate limiting, routing |
| `nphies-proxy` | 8788 | KV: NPHIES_CACHE_KV | NPHIES FHIR R4 proxy with caching |
| `document-store` | 8789 | R2: DOCUMENTS_R2 | Clinical document upload/retrieval |
| `compliance-db` | 8790 | D1: COMPLIANCE_DB | CBAHI findings, claims, audit log |
| `ed-flow` | 8791 | KV: SESSION_KV, METRICS_KV | ED orchestration and metrics caching |

## Prerequisites

- Node.js ≥ 20
- Wrangler CLI: `npm install -g wrangler`
- Cloudflare account with Workers, KV, D1, and R2 enabled
- `CF_API_TOKEN` and `CF_ACCOUNT_ID`

## Quick Start

```bash
# 1. Install dependencies
cd workers && npm install

# 2. Configure environment
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your Cloudflare credentials

# 3. Provision Cloudflare resources (creates KV/D1/R2, patches wrangler.toml)
npm run cf:setup

# 4. Apply D1 migrations locally
npm run migrate:local

# 5. Start all workers in dev mode
npm run dev:all
```

## Deployment

### Manual
```bash
cd workers
npm run deploy:all          # deploy all 4 workers
npm run deploy:gateway      # deploy only api-gateway
npm run deploy:compliance   # deploy only compliance-db
npm run migrate:remote      # apply D1 migrations to production
```

### Automated (GitHub Actions)
Push to `main` → `.github/workflows/deploy-workers.yml` runs all deployments automatically.

Required GitHub secrets:
- `CF_API_TOKEN` — Cloudflare API token (Workers+KV+D1+R2 edit)
- `CF_ACCOUNT_ID` — Cloudflare account ID

## Cloudflare Resources

### KV Namespaces
| Binding | Used By | Purpose |
|---------|---------|---------|
| `SESSIONS_KV` | api-gateway | JWT session tokens (TTL: 1 hour) |
| `RATELIMIT_KV` | api-gateway | Rate limit counters (sliding window) |
| `NPHIES_CACHE_KV` | nphies-proxy | Eligibility cache (5 min), claim status cache (60 sec) |
| `SESSION_KV` | ed-flow | ED encounter sessions and audit events |
| `METRICS_KV` | ed-flow | 60-second dashboard cache for operational metrics |

### D1 Database: `healthbridge-compliance`
Tables:
- `facilities` — KSA healthcare facility registry
- `cbahi_findings` — CBAHI survey findings with status tracking
- `claim_records` — NPHIES claim submission log
- `audit_log` — Full audit trail
- `readiness_scores` — Historical CBAHI readiness scores

### R2 Bucket: `healthbridge-documents`
Object key format: `{facilityId}/{docType}/{documentId}`

Supported doc types: `cbahi | discharge | audit | imaging | policy | prescription | lab`

Allowed MIME types: PDF, JPEG, PNG, TIFF, DICOM (max 50MB)

## Secrets

Set via Wrangler (never in wrangler.toml or .dev.vars committed to git):

```bash
# From workers/api-gateway/
wrangler secret put JWT_SECRET

# From workers/nphies-proxy/
wrangler secret put NPHIES_CLIENT_ID
wrangler secret put NPHIES_CLIENT_SECRET
```

## API Reference

### API Gateway (`/api/*`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/health` | GET | No | Health check |
| `/api/auth/token` | POST | No | Issue JWT (requires facilityId + apiKey) |
| `/api/nphies/*` | * | JWT | Proxied to nphies-proxy |
| `/api/documents/*` | * | JWT | Proxied to document-store |
| `/api/compliance/*` | * | JWT | Proxied to compliance-db |

### NPHIES Proxy (`/api/nphies/*`)

| Endpoint | Method | Cache | Description |
|----------|--------|-------|-------------|
| `/api/nphies/eligibility/:memberId` | GET | KV 5 min | Eligibility check |
| `/api/nphies/claims` | POST | No | Submit FHIR claim bundle |
| `/api/nphies/claims/:id/status` | GET | KV 60 sec | Claim status |
| `/api/nphies/preauth` | POST | No | Pre-authorization |

### Document Store (`/api/documents/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/documents/:facilityId/:docType/:docId` | PUT | Upload to R2 |
| `/api/documents/:facilityId/:docType/:docId` | GET | Download from R2 |
| `/api/documents/:facilityId/:docType/:docId` | HEAD | Metadata only |
| `/api/documents/:facilityId/:docType/:docId` | DELETE | Delete from R2 |
| `/api/documents/:facilityId/:docType` | GET | List by type |

### Compliance DB (`/api/compliance/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/compliance/facilities` | GET/POST | List / create facilities |
| `/api/compliance/facilities/:id` | GET | Get facility |
| `/api/compliance/findings/:facilityId` | GET | List CBAHI findings |
| `/api/compliance/findings` | POST | Create finding |
| `/api/compliance/findings/:id` | PUT/DELETE | Update / delete finding |
| `/api/compliance/claims/:facilityId` | GET | List claims |
| `/api/compliance/claims` | POST | Record claim |
| `/api/compliance/claims/:id/status` | PUT | Update claim status |
| `/api/compliance/readiness/:facilityId` | GET | Compute readiness score |
| `/api/compliance/audit` | POST | Write audit entry |
| `/api/compliance/audit/:facilityId` | GET | Read audit log |

### ED-Flow (`/ed/*`, `/webhooks/n8n/*`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ed/health` | GET | Worker health check |
| `/ed/check-in` | POST | Register ED arrival and cache session metadata |
| `/ed/:encounterId/triage` | POST | Forward triage updates to the backend |
| `/ed/:encounterId/assign-bed` | POST | Assign bed and update cached session |
| `/ed/metrics` | GET | Read-through cached ED dashboard metrics |
| `/ed/sessions` | GET | List active ED sessions (admin only) |
| `/webhooks/n8n/ed-event` | POST | Fan out ED workflow events to n8n |
