# AGENTS.md - KSA Digital Health Platform

## Project Context

Building a suite of digital health products for the Saudi Arabian market:

- **NPHIES Survival Bridge** — Compliance middleware connecting legacy PMS to NPHIES
- **FlowClinic Express** — Patient flow optimizer for high-volume polyclinics
- **CBAHI Remediation Suite** — Accreditation recovery tools for hospitals
- **Specialty Smart-Forms** — Vertical modules for Dental, Derma, Ophthalmology

Target market: Small-to-mid healthcare facilities in Riyadh (10–150 beds), specifically the ~200+ facilities struggling with NPHIES compliance, CBAHI accreditation, and operational inefficiency.

## Session Startup

1. Read `SOUL.md` — project persona and working style
2. Read `USER.md` — stakeholder context
3. Read `memory/YYYY-MM-DD.md` (today + yesterday) for recent context
4. **If in MAIN SESSION:** Also read `MEMORY.md`

## Working Conventions

### Code & Architecture
- All services are **microservices, containerized** (Docker/K8s)
- Hosting targets: **AWS Bahrain** or **Oracle Cloud Jeddah** (SDAIA compliance)
- Patient data is **always classified as Sensitive** — AES-256 at rest, TLS 1.3 in transit
- Data residency: **KSA borders only** — no exceptions
- Default stack: Node.js/TypeScript for services, React for frontend, PostgreSQL for persistence
- FHIR R4 is the interoperability standard — use HAPI FHIR as reference implementation

### Documentation Standards
- Every product module gets a `README.md` with: purpose, API endpoints, config, deployment steps
- API specs use **OpenAPI 3.1** format
- Architecture decisions recorded in `docs/adr/` (Architecture Decision Records)
- Regulatory compliance checklist updated per product release

### Branching & Commits
- `main` → production-ready
- `develop` → integration branch
- Feature branches: `feat/product-name/feature-description`
- Fix branches: `fix/product-name/issue-description`
- Commit messages: `type(scope): description` (conventional commits)

### Testing
- Unit tests required for all business logic (especially claim scrubbing rules)
- Integration tests against NPHIES sandbox before any production deploy
- Shadow mode comparison reports serve as UAT acceptance criteria

## Red Lines

- **Never** store real patient data in non-production environments (use synthetic data generators)
- **Never** commit API keys, NPHIES credentials, or ZATCA certificates to the repo
- **Never** bypass SDAIA data classification requirements
- **Never** deploy to production without passing the compliance checklist in `docs/compliance-checklist.md`
- When in doubt about regulatory interpretation, document the question and escalate — don't guess

## File Organization

```
workspace/
├── products/
│   ├── nphies-bridge/          # Product A: Compliance Middleware
│   ├── flowclinic/             # Product B: Patient Flow
│   ├── cbahi-suite/            # Product C: Accreditation Recovery
│   └── specialty-forms/        # Product D: Vertical Modules
├── shared/
│   ├── fhir-mappers/           # Reusable FHIR R4 mapping logic
│   ├── nphies-client/          # NPHIES API client library
│   ├── zatca-client/           # ZATCA e-invoicing client
│   └── common-ui/              # Shared React components (Arabic/English RTL)
├── infra/
│   ├── terraform/              # IaC for AWS Bahrain / Oracle Jeddah
│   ├── docker/                 # Dockerfiles per service
│   └── k8s/                    # Kubernetes manifests
├── docs/
│   ├── compliance-checklist.md
│   ├── api-specs/              # OpenAPI 3.1 specs
│   └── adr/                    # Architecture Decision Records
├── sales/
│   ├── playbook.md             # The execution playbook (ksa-digital-health-playbook.md)
│   ├── roi-calculator/         # SAR-denied-claim recovery calculator
│   └── demo-environments/      # Sandboxes for sales demos
└── memory/                     # Agent memory (not committed)
```

## Memory

- **Daily notes:** `memory/YYYY-MM-DD.md` — dev decisions, blockers, meeting notes
- **Long-term:** `MEMORY.md` — architectural decisions, lessons learned, stakeholder preferences
- **Write things down.** Memory doesn't survive session restarts. Files do.

## Key Stakeholders & Communication

- **Technical questions** → Check docs first, then search memory, then ask
- **Regulatory questions** → Always document the question + the answer for future reference
- **Sales/BD questions** → Reference the playbook at `ksa-digital-health-playbook.md`
- **Demo prep** → Use synthetic data from `sales/demo-environments/`

## Heartbeat Behavior

When idle, prioritize:
1. Check for NPHIES sandbox API changes or deprecation notices
2. Review recent memory files for open action items
3. Update compliance checklist if regulatory news surfaced
4. Keep `MEMORY.md` curated with architectural and regulatory learnings

If nothing needs attention: `HEARTBEAT_OK`
