# TOOLS.md — Tech Stack & Environment Notes

## Development Stack

### Core Services
| Component | Technology | Notes |
|---|---|---|
| Integration Engine | Apache Camel / Node-RED | HL7/FHIR routing between legacy PMS and NPHIES |
| API Gateway | Kong / AWS API Gateway | Rate limiting, auth, routing |
| FHIR Server | HAPI FHIR R4 | Open-source, Java-based, FHIR-compliant |
| Primary Database | PostgreSQL 15+ | Encrypted at rest (AES-256), Multi-AZ |
| Message Queue | RabbitMQ | Async claim processing, retry logic |
| Cache / Queue Engine | Redis | Real-time queue state (FlowClinic) |
| Document DB | MongoDB | Ephemeral patient session data |

### Frontend
| Component | Technology | Notes |
|---|---|---|
| Web Dashboard | React 18+ | Arabic/English RTL, i18n via react-intl |
| Kiosk App | React Native | Android tablets for patient self-registration |
| DICOM Viewer | cornerstone.js | Browser-based, no plugin needed |
| Charts/Analytics | Recharts | CBAHI readiness dashboard |

### Infrastructure
| Component | Technology | Notes |
|---|---|---|
| Hosting | AWS Bahrain / Oracle Jeddah | SDAIA data residency compliance |
| Containers | Docker + Kubernetes (EKS) | All services containerized |
| IaC | Terraform | Infra as code, version controlled |
| CI/CD | GitHub Actions | Test → Build → Deploy pipeline |
| Monitoring | Datadog / CloudWatch | APM, logs, alerts |
| Secrets | AWS Secrets Manager | Never in code, never in env files |

## API Integrations

### Priority 1 — MVP
| API | Purpose | Auth Method | Docs |
|---|---|---|---|
| **NPHIES** | Eligibility, claims, pre-auth | SMART on FHIR OAuth2 | nphies.sa |
| **ZATCA** | e-Invoicing Phase 2 | Certificate-based | zatca.gov.sa |
| **WhatsApp Business** | Patient notifications | Twilio / Cloud API | twilio.com |

### Priority 2 — V1.1
| API | Purpose | Auth Method | Docs |
|---|---|---|---|
| **RxNav** | Drug interaction checking | API Key (free, NIH) | nih.gov |
| **Google Cloud STT** | Voice-to-text SOAP notes | Service Account JSON | cloud.google.com |
| **Unifonic / Slaicom** | SMS gateway (local KSA) | API Key | unifonic.com |

### Priority 3 — V2.0
| API | Purpose | Notes |
|---|---|---|
| **DICOM (WADO)** | Imaging device integration | For dental X-ray, OCT |
| **BLE/FHIR Device** | Vitals monitor integration | Philips, Mindray, GE |
| **AI/ML Services** | Lesion tracking, claim prediction | Custom models or cloud ML |

## PMS Legacy Adapters

### Target Systems (Riyadh Market)
| PMS | Type | Data Access Method | Priority |
|---|---|---|---|
| **Accumed** | Cloud + On-prem | SQL export + API (if licensed) | P0 |
| **Medware** | On-prem | SQL direct access + HL7v2 feed | P0 |
| **Cerner** | Cloud (Oracle Health) | FHIR API (if licensed) | P1 |
| **Epic** | Enterprise | FHIR API (rare in small facilities) | P2 |
| **Custom/Excel** | Manual | CSV/XLSX file import | P1 (common in small clinics) |

### Adapter Pattern
```
Legacy PMS → [File Watcher / SQL Poll / HL7 Listener]
           → [Parser: CSV/XML/HL7v2/SQL]
           → [FHIR R4 Mapper]
           → [NPHIES Connector]
```

## Demo & Testing

### NPHIES Sandbox
- URL: Check `secrets/nphies-sandbox.env` (never commit)
- Test facility credentials: Available from NPHIES portal
- Test scenarios: Eligibility check, claim submission, pre-auth request

### Synthetic Data Generator
- Location: `tools/synthetic-data/`
- Generates: Patient records, encounter notes, claim data
- Rule: **Never use real patient data in non-production**

### Demo Environments
- Location: `sales/demo-environments/`
- Pre-loaded with synthetic data for each product
- Reset script: `tools/reset-demo.sh`

## Useful Commands

```bash
# Start local dev environment
docker-compose -f infra/docker/docker-compose.dev.yml up -d

# Run NPHIES sandbox integration tests
npm run test:integration -- --env=sandbox

# Generate synthetic data for demo
node tools/synthetic-data/generate.js --facility=polyclinic --patients=500

# Deploy to staging
terraform -chdir=infra/terraform apply -var-file=staging.tfvars

# Reset demo environment
bash tools/reset-demo.sh --product=flowclinic
```

## Environment Variables

Managed via AWS Secrets Manager in production. Local dev uses `.env.local` (gitignored).

Required variables:
```
NPHIES_SANDBOX_URL=
NPHIES_CLIENT_ID=
NPHIES_CLIENT_SECRET=
NPHIES_FACILITY_ID=
ZATCA_CERT_PATH=
ZATCA_PRIVATE_KEY_PATH=
WHATSAPP_API_KEY=
DB_CONNECTION_STRING=
ENCRYPTION_KEY=
```

⚠️ **Never commit `.env` files. Never log secret values. Never store in memory files.**
