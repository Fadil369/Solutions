# Solutions

A collection of projects, tools, and skill frameworks.

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
