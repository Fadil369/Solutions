# 🏥 BrainSAIT ED Flow Management System - Deployment Guide

**Target**: Real-time Emergency Department queue management for Saudi hospitals (NGHA, KAMC, SEC, etc.)

**Architecture**: 
- **Backend**: FastAPI (FHIR R4 + NPHIES compliant)
- **Edge**: Cloudflare Workers + KV (global distribution)
- **Automation**: n8n workflows (notifications, specialist alerts)
- **Frontend**: React dashboard (glass morphism, bilingual)

---

## 📋 Prerequisites

- [ ] Cloudflare account with Workers & KV namespace access
- [ ] FastAPI backend server (Cloudflare Tunnel or Oracle RAD Portal)
- [ ] n8n instance (self-hosted on VPS or SRV791040)
- [ ] Node.js 18+ for Cloudflare Worker deployment
- [ ] Python 3.10+ for FastAPI backend
- [ ] Database: PostgreSQL (optional, for persistence)
- [ ] SMS gateway: Twilio API key (for patient notifications)
- [ ] Teams/Slack webhook for specialist alerts

---

## 🚀 PHASE 1: Deploy FastAPI Backend

### 1.1 Install Dependencies

```bash
cd /path/to/brainsait-ed-flow
pip install -r requirements.txt
```

**requirements.txt**:
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
python-multipart==0.0.6
cryptography==41.0.7
python-jose[cryptography]==3.3.0
```

### 1.2 Environment Configuration

Create `.env`:
```env
# FastAPI Config
BACKEND_HOST=0.0.0.0
BACKEND_PORT=8000

# HIPAA Encryption
ENCRYPTION_KEY=<Fernet-generated-key>

# Hospital Codes (customize per deployment)
HOSPITAL_CODE=NGHA
ED_BED_CAPACITY=50

# NPHIES Integration
NPHIES_API_URL=https://api.nphies.sa/v1
NPHIES_CLIENT_ID=<your-client-id>
NPHIES_CLIENT_SECRET=<your-secret>

# Cloudflare Tunnel
CLOUDFLARE_TUNNEL_URL=https://ed-flow.elfadil.com

# Database (optional)
DATABASE_URL=postgresql://user:pass@localhost/brainsait_ed

# Logging
LOG_LEVEL=INFO
```

### 1.3 Generate Encryption Key

```python
from cryptography.fernet import Fernet
key = Fernet.generate_key()
print(key.decode())  # Store in .env
```

### 1.4 Run Locally (Development)

```bash
uvicorn ed_flow_system:app --reload --host 0.0.0.0 --port 8000
```

Test endpoint:
```bash
curl -X POST http://localhost:8000/ed/check-in \
  -H "Content-Type: application/json" \
  -H "X-User-Role: nurse" \
  -d '{
    "patient_id": "PAT-001",
    "chief_complaint": "Chest pain",
    "triage_level": "2"
  }'
```

### 1.5 Deploy via Cloudflare Tunnel

If using Oracle RAD Portal or on-prem server:

```bash
# Install cloudflared
curl -L --output cloudflared.tgz https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.tgz
tar -xzf cloudflared.tgz
sudo mv cloudflared /usr/local/bin/

# Authenticate
cloudflared tunnel login

# Create tunnel for ED Flow backend
cloudflared tunnel create ed-flow-backend

# Configure routing in ~/.cloudflared/config.yml
# Then expose the tunnel:
cloudflared tunnel run ed-flow-backend
```

**config.yml** (on server):
```yaml
tunnel: ed-flow-backend
credentials-file: ~/.cloudflared/<UUID>.json

ingress:
  - hostname: ed-flow.elfadil.com
    service: http://localhost:8000
  - service: http_status:404
```

### 1.6 Verify Backend Deployment

```bash
curl -X GET https://ed-flow.elfadil.com/ed/metrics \
  -H "X-User-Role: admin"
```

Expected response:
```json
{
  "hospital_code": "NGHA",
  "timestamp": "2026-04-08T...",
  "total_patients": 0,
  "capacity": 50,
  "occupancy_percentage": 0.0,
  "alerts": [],
  "alert_color": null
}
```

---

## ☁️ PHASE 2: Deploy Cloudflare Worker

### 2.1 Create KV Namespaces

```bash
wrangler kv:namespace create "SESSION_KV"
# Returns: { "id": "079016c359c348e180724cdd76f29129", ... }

wrangler kv:namespace create "METRICS_KV"
# Returns: { "id": "abc123...", ... }
```

### 2.2 Configure wrangler.toml

```toml
name = "ed-flow-worker"
main = "src/index.ts"
compatibility_date = "2025-04-01"

[env.production]
routes = [{ pattern = "ed-flow.brainsait.org/*", zone_id = "your-zone-id" }]
vars = {
  BACKEND_URL = "https://ed-flow.elfadil.com",
  N8N_WEBHOOK_URL = "https://n8n.srv791040.hstgr.cloud/webhook/ed-flow"
}

[[kv_namespaces]]
binding = "SESSION_KV"
id = "079016c359c348e180724cdd76f29129"

[[kv_namespaces]]
binding = "METRICS_KV"
id = "abc123def456"
```

### 2.3 Build & Deploy

```bash
npm install -D wrangler
npm install itty-router

# Build
npm run build

# Deploy to production
wrangler deploy --env production
```

### 2.4 Verify Worker

```bash
curl -X GET https://ed-flow.brainsait.org/ed/metrics \
  -H "X-User-Role: admin" \
  -H "Authorization: Bearer <token>"
```

---

## 🤖 PHASE 3: Setup n8n Automation

### 3.1 Import Workflow

1. **Log into n8n**: `https://n8n.srv791040.hstgr.cloud/`
2. **Import Workflow**: Use `ed-flow-n8n-workflow.json`
3. **Configure Credentials**:
   - **Twilio**: Add account SID, auth token
   - **Teams/Slack**: Add webhook URL
   - **Airtable**: Add API key & base ID
   - **BrainSAIT API**: Add Bearer token

### 3.2 Customize Workflow

#### Update Patient Phone Lookup
In the "Generate Bilingual SMS" node, enhance to fetch from patient database:

```javascript
// Fetch patient phone from Airtable or database
const patientId = $input.all()[0].json.patient_id;
const response = await $helpers.httpRequest({
  method: 'GET',
  url: `https://api.airtable.com/v0/${BASE_ID}/Patients?filterByFormula={patient_id}="${patientId}"`,
  headers: { Authorization: 'Bearer AIRTABLE_KEY' }
});
const patient = response.records[0];
return { patient_phone: patient.fields.phone };
```

#### Add Specialist Database Lookup
Create a Notion database with specialist rotations:

```javascript
const specialist = await notion.databases.query({
  database_id: 'SPECIALIST_DB_ID',
  filter: {
    property: 'Department',
    select: { equals: $json.specialist_department }
  }
});
return { specialist_phone: specialist.results[0].phone };
```

### 3.3 Test Workflow

1. Trigger manually with test payload:
```json
{
  "action": "PATIENT_CHECK_IN",
  "encounter_id": "ED-NGHA-20260408123456",
  "details": {
    "patient_phone": "+966501234567",
    "chief_complaint": "Chest pain",
    "triage_level": "2",
    "language": "ar"
  }
}
```

2. Verify outputs:
   - [ ] SMS sent to patient (Arabic)
   - [ ] Specialist alerted via Teams
   - [ ] Airtable record updated
   - [ ] Backend status updated

### 3.4 Schedule Periodic Tasks

Create additional workflows for:
- **Hourly KPI aggregation**: `GET /ed/metrics` → Airtable/Analytics
- **Daily compliance report**: Generate CBAHI/JCI summary
- **Exit-block detection**: Alert when occupancy > 85%

---

## 🎨 PHASE 4: Deploy React Dashboard

### 4.1 Create Next.js App

```bash
npx create-next-app@latest ed-flow-dashboard \
  --typescript \
  --tailwind \
  --eslint

cd ed-flow-dashboard
```

### 4.2 Install Dependencies

```bash
npm install lucide-react axios zustand
npm install -D tailwindcss postcss autoprefixer
```

### 4.3 Add Dashboard Component

Create `app/components/EDDashboard.tsx` and copy the React component code.

**app/page.tsx**:
```typescript
'use client';

import EDDashboard from './components/EDDashboard';
import { useCallback, useState } from 'react';

export default function Home() {
  const [language, setLanguage] = useState<'en' | 'ar'>('en');
  const [userRole, setUserRole] = useState<'nurse' | 'physician' | 'admin'>('nurse');

  return (
    <div>
      {/* Language/Role Toggle */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          className="px-3 py-1 bg-[#2b6cb8] text-white rounded-lg text-sm"
        >
          {language === 'en' ? 'العربية' : 'English'}
        </button>
      </div>

      <EDDashboard
        apiUrl={process.env.NEXT_PUBLIC_API_URL || 'https://ed-flow.brainsait.org'}
        language={language}
        userRole={userRole}
      />
    </div>
  );
}
```

### 4.4 Configure Environment

**.env.local**:
```env
NEXT_PUBLIC_API_URL=https://ed-flow.brainsait.org
NEXT_PUBLIC_HOSPITAL_CODE=NGHA
AUTH_TOKEN=<bearer-token>
```

### 4.5 Deploy to Vercel

```bash
npm install -g vercel
vercel login
vercel deploy --prod
```

Or deploy to Cloudflare Pages:

```bash
npm run build
wrangler pages deploy out --project-name=ed-flow-dashboard
```

---

## 🔐 PHASE 5: Security & Compliance

### 5.1 API Authentication

Add JWT token validation:

```python
# FastAPI: Add to ed_flow_system.py
from fastapi.security import HTTPBearer, HTTPAuthCredentials
from jose import JWTError, jwt

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthCredentials = Depends(security)):
    try:
        payload = jwt.decode(
            credentials.credentials,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )
        user_role: str = payload.get("role")
    except JWTError:
        raise HTTPException(status_code=403, detail="Invalid token")
    return user_role
```

### 5.2 NPHIES Compliance

**Register as Healthcare Provider**:
1. Visit: https://nphies.sa
2. Complete KYC process
3. Obtain API credentials
4. Implement FHIR R4 validation

**Integrate NPHIES Eligibility Check**:

```python
async def verify_nphies_eligibility(patient_id: str):
    """
    MEDICAL: Validate against NPHIES before accepting patient
    """
    response = await httpx.get(
        f"{NPHIES_API_URL}/eligibility/check",
        headers={
            "Authorization": f"Bearer {NPHIES_TOKEN}",
            "Accept": "application/fhir+json"
        },
        params={"patient_id": patient_id}
    )
    return response.json()
```

### 5.3 HIPAA Audit Logging

All endpoints log to:
- **Cloudflare KV**: `audit:encounter_id:timestamp`
- **PostgreSQL**: `audit_logs` table
- **SIEM**: Send to security monitoring

Example audit entry:
```json
{
  "timestamp": "2026-04-08T14:30:00Z",
  "hospital": "NGHA",
  "action": "PATIENT_CHECK_IN",
  "encounter_id": "ED-NGHA-20260408143000",
  "user_role": "nurse",
  "user_id_hash": "abc123...",
  "ip_hash": "def456...",
  "details": { "triage_level": "2" }
}
```

---

## 📊 PHASE 6: Monitoring & Analytics

### 6.1 Setup Cloudflare Analytics

Enable in Cloudflare Dashboard:
- **Worker Analytics**: Track API latency, errors
- **KV Analytics**: Monitor cache hit rate
- **Real User Monitoring**: Track dashboard performance

### 6.2 Create Dashboard Analytics Workflow

n8n workflow to aggregate hourly metrics:

```javascript
// Fetch metrics every hour
const metrics = await fetch('https://ed-flow.brainsait.org/ed/metrics');
const data = await metrics.json();

// Store in Airtable for historical tracking
await airtable.create('tbl_ed_analytics', {
  fields: {
    timestamp: new Date().toISOString(),
    occupancy_percentage: data.occupancy_percentage,
    avg_wait_minutes: data.avg_wait_to_triage_minutes,
    critical_count: data.critical_count,
    hospital_code: data.hospital_code
  }
});

// Alert if thresholds exceeded
if (data.occupancy_percentage > 95) {
  await teams.sendAlert({
    title: 'CRITICAL: ED at 95% capacity',
    priority: 'HIGH'
  });
}
```

### 6.3 Weekly CBAHI Report

Automated via n8n → Email to Quality Manager:

```bash
# Every Monday 8:00 AM
curl https://ed-flow.brainsait.org/ed/cbahi-report \
  ?start_date=2026-04-01 \
  &end_date=2026-04-07 \
  -H "X-User-Role: admin"
```

---

## 🧪 Testing Checklist

### Unit Tests

```bash
pytest tests/test_ed_flow.py -v
```

### Integration Tests

```bash
# Test full workflow: check-in → triage → bed assignment
pytest tests/test_integration.py::test_patient_journey -v
```

### Load Testing

```bash
# Simulate 100 concurrent ED check-ins
ab -n 1000 -c 100 \
  -H "X-User-Role: nurse" \
  -p payload.json \
  https://ed-flow.brainsait.org/ed/check-in
```

### Security Tests

- [ ] Test unauthorized access (missing X-User-Role header)
- [ ] Verify encryption of PHI in transit (TLS 1.3)
- [ ] Check audit log completeness
- [ ] Validate FHIR schema compliance

---

## 🚨 Troubleshooting

### Issue: Cloudflare Worker timeout
**Solution**: Increase timeout in wrangler.toml, or defer long operations to n8n

### Issue: NPHIES API rate limit
**Solution**: Implement request queuing with Cloudflare Durable Objects

### Issue: Dashboard doesn't update
**Solution**: Clear browser cache, verify CORS headers in Cloudflare Worker

### Issue: SMS not sending
**Solution**: Check Twilio credentials, verify patient phone format (+966...)

---

## 📈 Roadmap

- **v1.1**: Add predictive ED capacity model (ML)
- **v1.2**: Integrate HL7 v2 legacy system gateways
- **v1.3**: Support multi-hospital federation (KAMC, SEC, etc.)
- **v1.4**: Add Apple HealthKit integration for post-discharge follow-up
- **v2.0**: Full LINC agent ecosystem integration (HEALTHCARELINC, COMPLIANCELINC)

---

## 📞 Support

For issues or questions:
- **GitHub**: fadil369/brainsait-ed-flow
- **Docs**: https://docs.brainsait.org/ed-flow
- **Email**: support@brainsait.org

---

**Last Updated**: 2026-04-08 | **Version**: 1.0.0
