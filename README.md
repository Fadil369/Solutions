# Solutions

A collection of projects, tools, and skill frameworks.

## 🌐 Live Pages

**GitHub Pages site:** `https://fadil369.github.io/Solutions/`

| Page | URL |
|------|-----|
| Main landing | `/Solutions/` |
| Integrations hub | `/Solutions/integrations/` |
| DoctorLinc integration | `/Solutions/integrations/doctorlinc/` |
| ED-Flow integration | `/Solutions/integrations/ed-flow/` |
| HealthBridge Platform | `/Solutions/healthbridge/` |
| Downloads | `/Solutions/healthbridge/downloads.html` |
| FlowClinic Kiosk Demo | `/Solutions/healthbridge/demos/flowclinic-kiosk/` |
| Dental Chart Demo | `/Solutions/healthbridge/demos/dental-chart/` |

## ☁️ Cloudflare Workers

Five edge workers deployed under your Cloudflare account:

| Worker | Route | Bindings |
|--------|-------|----------|
| `api-gateway` | `/api/*` | KV: sessions, rate-limit |
| `nphies-proxy` | `/api/nphies/*` | KV: FHIR cache |
| `document-store` | `/api/documents/*` | R2: clinical docs |
| `compliance-db` | `/api/compliance/*` | D1: CBAHI/claims DB |
| `ed-flow` | `/ed/*`, `/webhooks/n8n/*` | KV: ED sessions, metrics |

See [`workers/README.md`](workers/README.md) for full API reference and setup.

## Projects

### HealthBridge — KSA Digital Health Platform
- **NPHIES Bridge** — Compliance middleware connecting legacy PMS to Saudi Arabia's NPHIES platform
- **FlowClinic** — Patient flow optimizer for high-volume polyclinics
- **CBAHI Suite** — Accreditation recovery tools for hospitals
- **Specialty Forms** — Vertical modules for Dental, Derma, Ophthalmology

### Apps
- **Chat App** — Real-time chat application
- **Photo Gallery** — Image gallery with upload and management
- **Function Plotter** — Mathematical function visualization
- **UECD PWA** — Progressive web app

### Frameworks
- **NHexic Framework** — Modular framework architecture
- **Packages** — Shared libraries (jest-docblock, pretty-format)

## Deployment

### GitHub Pages
Automatically deployed on push to `main`. Source: `docs/` directory.

Enable in repo Settings → Pages → Source: **GitHub Actions**.

### Cloudflare Workers
```bash
cd workers
cp .dev.vars.example .dev.vars   # Add CF_API_TOKEN, CF_ACCOUNT_ID
npm install
npm run cf:setup                  # Create KV, D1, R2 resources
npm run migrate:local             # Apply D1 schema
npm run dev:all                   # Run all 5 workers locally
npm run deploy:all                # Deploy to Cloudflare
```

CI/CD: push to `main` triggers `.github/workflows/deploy-workers.yml`.
Required secrets: `CF_API_TOKEN`, `CF_ACCOUNT_ID`.

## Skills System

26 specialized skill modules with decision frameworks, anti-patterns, and trigger phrases.

| Category | Skills |
|----------|--------|
| Security & Auth | authentication-flow-designer |
| API & Integration | api-integration-layer |
| Database & Data | database-schema-designer, data-migration-orchestrator |
| Architecture | component-lifecycle-manager, multi-tenant-architecture, state-machine-designer |
| DevOps & Infra | deployment-pipeline-architect, feature-flag-system |
| Accessibility | accessibility-pattern-library |
| UI Patterns | form-pattern-engine, dashboard-composition-engine |
| Reliability | error-recovery-orchestrator, performance-budget-enforcer |
| And more... | 15 additional specialized skills |

### Managing Skills

```bash
python3 scripts/manage-skills.py index      # Rebuild skill index
python3 scripts/manage-skills.py search "query"  # Search skills
python3 scripts/manage-skills.py validate   # Validate all skills
python3 scripts/manage-skills.py stats      # Show statistics
```

## Testing

```bash
python3 test/test.py                    # Quick validation (5 tests)
python3 test/test-comprehensive.py      # Full suite (389+ assertions)
```

## Project Docs

- `AGENTS.md` — Agent configuration and conventions
- `SOUL.md` — Project persona and working style
- `TOOLS.md` — Tech stack reference
- `SKILLS-GUIDE.md` — Complete skills documentation
- `ksa-digital-health-playbook.md` — Sales and execution playbook

## License

MIT
