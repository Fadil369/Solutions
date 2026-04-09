# MCP.md — Model Context Protocol Configuration

## What MCP Servers We Need

MCP servers provide structured tool access for specific domains. Here's what this project requires.

## Configured MCP Servers

### Development Tools

```json
{
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
    },
    "description": "PR management, issue tracking, code review for all product repos"
  }
}
```

### Documentation & Knowledge

```json
{
  "filesystem": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"],
    "description": "Read/write project files, docs, and configurations"
  },
  "memory": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-memory"],
    "description": "Persistent project memory across sessions — decisions, contacts, learnings"
  }
}
```

### Healthcare Domain (Custom — To Be Built)

```json
{
  "nphies-sandbox": {
    "command": "node",
    "args": ["./mcp-servers/nphies-sandbox/server.js"],
    "env": {
      "NPHIES_SANDBOX_URL": "${NPHIES_SANDBOX_URL}",
      "NPHIES_CLIENT_ID": "${NPHIES_CLIENT_ID}",
      "NPHIES_CLIENT_SECRET": "${NPHIES_CLIENT_SECRET}",
      "NPHIES_FACILITY_ID": "${NPHIES_FACILITY_ID}"
    },
    "description": "NPHIES sandbox interaction — eligibility checks, claim submission, pre-auth testing"
  },
  "fhir-validator": {
    "command": "node",
    "args": ["./mcp-servers/fhir-validator/server.js"],
    "description": "Validate FHIR R4 resources against NPHIES profiles and base spec"
  }
}
```

### Data & Analytics

```json
{
  "postgres": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-postgres"],
    "env": {
      "POSTGRES_CONNECTION_STRING": "${DB_CONNECTION_STRING}"
    },
    "description": "Query staging/demo databases for analytics, debugging, and data validation"
  }
}
```

## Custom MCP Servers to Build

### Priority P0 — MVP

#### 1. `nphies-sandbox`
**Purpose:** Structured interaction with NPHIES sandbox API

**Tools to expose:**
- `check_eligibility` — Patient coverage verification via Tameen
- `submit_claim` — Claim submission via Masdar
- `request_preauth` — Pre-authorization request
- `check_claim_status` — Poll claim adjudication status
- `get_rejection_codes` — Fetch CCHI rejection code reference

**Implementation:**
```
mcp-servers/nphies-sandbox/
├── server.js          # MCP server entry point
├── handlers/
│   ├── eligibility.js  # Tameen service integration
│   ├── claims.js       # Masdar service integration
│   └── preauth.js      # Pre-authorization
├── lib/
│   ├── fhir-client.js  # HAPI FHIR client wrapper
│   └── auth.js         # SMART on FHIR OAuth2
└── package.json
```

#### 2. `fhir-validator`
**Purpose:** Validate FHIR resources before NPHIES submission

**Tools to expose:**
- `validate_resource` — Check a FHIR resource against a specific profile
- `validate_bundle` — Validate a FHIR Bundle (e.g., claim + supporting info)
- `check_nphies_profile` — Validate against NPHIES-specific extensions
- `suggest_fixes` — Auto-suggest corrections for common validation errors

### Priority P1 — V1.1

#### 3. `claim-scrubber`
**Purpose:** Pre-submission claim quality checks

**Tools to expose:**
- `scrub_claim` — Run a claim against CCHI rejection rules
- `check_icd_mapping` — Validate ICD-10 AM / AR-DRG code mapping
- `verify_zatca` — Check ZATCA tax ID and e-invoice format
- `estimate_rejection_risk` — Score a claim's likelihood of rejection

#### 4. `cbahi-auditor`
**Purpose:** Audit facility readiness against CBAHI standards

**Tools to expose:**
- `audit_documentation` — Check chart completeness
- `check_drug_interactions` — Verify prescription safety
- `score_readiness` — Generate CBAHI readiness score
- `generate_report` — Produce surveyor-ready audit report

### Priority P2 — V2.0

#### 5. `synthetic-data`
**Purpose:** Generate realistic test data for demos and development

**Tools to expose:**
- `generate_patients` — Create synthetic patient records
- `generate_encounters` — Create encounter + claim data
- `generate_claims` — Create claim batches with realistic rejection rates
- `reset_demo` — Full demo environment reset

## Security Notes

- All MCP servers handling patient data must run in SDAIA-compliant environments
- API keys and credentials stored in AWS Secrets Manager, referenced via `${VAR}` syntax
- NPHIES credentials are **per-facility** — MCP server should support credential switching
- No real patient data in non-production MCP server instances
- All MCP server logs must exclude PHI (patient health information)

## Testing MCP Servers

```bash
# Test NPHIES sandbox connectivity
node mcp-servers/nphies-sandbox/test-connection.js

# Run FHIR validation against sample resources
node mcp-servers/fhir-validator/test.js --resources=./test-data/fhir-samples/

# Full integration test (sandbox)
npm run test:mcp -- --server=nphies-sandbox --env=sandbox
```
