# PLUGIN.md — Platform Plugins & Integrations

## Plugin Architecture

Each product is modular. Plugins extend functionality without modifying core systems. They follow a standard interface for installation, configuration, and lifecycle management.

## Plugin Interface

```typescript
interface Plugin {
  name: string;
  version: string;
  product: 'nphies-bridge' | 'flowclinic' | 'cbahi-suite' | 'specialty-forms';
  dependencies: string[];
  install(config: PluginConfig): Promise<void>;
  uninstall(): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
}
```

## Installed Plugins

### Product A: NPHIES Survival Bridge

| Plugin | Version | Purpose | Status |
|---|---|---|---|
| `legacy-adapter-accumed` | 1.0.0 | Data extraction from Accumed PMS | 🟡 In Development |
| `legacy-adapter-medware` | 1.0.0 | Data extraction from Medware PMS | 🟡 In Development |
| `legacy-adapter-csv` | 1.0.0 | Generic CSV/XML flat file import | 🟢 Active |
| `nphies-connector` | 1.0.0 | NPHIES Tameen + Masdar integration | 🟡 In Development |
| `zatca-invoicing` | 1.0.0 | ZATCA Phase 2 e-invoice generation | 🔴 Planned |
| `claim-scrubber` | 1.0.0 | CCHI rejection code pre-validation | 🟡 In Development |
| `icd10-mapper` | 1.0.0 | Free-text → AR-DRG code mapping | 🔴 Planned |
| `rejection-analytics` | 1.0.0 | Dashboard for claim rejection trends | 🔴 Planned |

### Product B: FlowClinic Express

| Plugin | Version | Purpose | Status |
|---|---|---|---|
| `kiosk-registration` | 1.0.0 | Multilingual patient self-registration (React Native) | 🟡 In Development |
| `whatsapp-queue` | 1.0.0 | Real-time queue updates via WhatsApp Business API | 🟡 In Development |
| `voice-soap` | 1.0.0 | Voice-to-text clinical notes (Google STT) | 🔴 Planned |
| `smart-billing` | 1.0.0 | Auto NPHIES claim + ZATCA invoice from encounter | 🔴 Planned |
| `sms-notifications` | 1.0.0 | Lab result delivery via SMS (Unifonic) | 🔴 Planned |

### Product C: CBAHI Remediation Suite

| Plugin | Version | Purpose | Status |
|---|---|---|---|
| `drug-interaction-alerts` | 1.0.0 | Real-time RxNav interaction checking | 🔴 Planned |
| `audit-trail` | 1.0.0 | Immutable logging (QLDB / Merkle tree) | 🔴 Planned |
| `vitals-auto-flow` | 1.0.0 | BLE → EMR vital signs capture | 🔴 Planned |
| `missing-signature-detector` | 1.0.0 | Pre-discharge chart completeness check | 🔴 Planned |
| `cbahi-readiness-dashboard` | 1.0.0 | Real-time accreditation score | 🔴 Planned |

### Product D: Specialty Smart-Forms

| Plugin | Version | Purpose | Status |
|---|---|---|---|
| `dental-tooth-chart` | 1.0.0 | Interactive 2D SVG tooth chart with auto-coding | 🔴 Planned |
| `derma-body-map` | 1.0.0 | Encrypted photo vault with body map overlay | 🔴 Planned |
| `ophthalmology-dicom` | 1.0.0 | Browser-based DICOM viewer (cornerstone.js) | 🔴 Planned |

## Plugin Development Guide

### Creating a New Plugin

```
plugins/
└── your-plugin-name/
    ├── manifest.json        # Plugin metadata
    ├── index.ts             # Plugin entry point
    ├── config/
    │   └── default.json     # Default configuration
    ├── handlers/            # Business logic
    ├── ui/                  # Frontend components (if applicable)
    ├── tests/
    │   ├── unit/
    │   └── integration/
    └── README.md            # Plugin documentation
```

### Manifest Format

```json
{
  "name": "nphies-connector",
  "version": "1.0.0",
  "product": "nphies-bridge",
  "description": "NPHIES Tameen and Masdar service integration",
  "author": "HealthBridge Team",
  "dependencies": ["fhir-r4-client", "smart-auth"],
  "configSchema": "./config/schema.json",
  "entryPoint": "./index.ts",
  "permissions": [
    "nphies:eligibility:read",
    "nphies:claims:write",
    "nphies:preauth:write"
  ],
  "dataClassification": "Sensitive",
  "encryptionRequired": true
}
```

### Plugin Lifecycle

```
1. Install    → npm install, config validation, dependency check
2. Configure  → Load config, validate against schema, set secrets
3. Initialize → Connect to external services, register routes
4. Run        → Process requests, emit events
5. Health     → Periodic health checks (connectivity, latency, errors)
6. Uninstall  → Graceful disconnect, cleanup, data export if needed
```

## Integration Partners

### Payment & Billing
| Partner | Integration Type | Status |
|---|---|---|
| ZATCA | e-Invoicing API (Phase 2) | 🔴 Pending certification |
| NPHIES Masdar | Claims submission | 🟡 Sandbox testing |

### Communication
| Partner | Integration Type | Status |
|---|---|---|
| WhatsApp Business (via Twilio) | Patient notifications | 🟡 In Development |
| Unifonic | SMS gateway (KSA local) | 🔴 Planned |
| Google Cloud STT | Voice-to-text | 🔴 Planned |

### Clinical
| Partner | Integration Type | Status |
|---|---|---|
| RxNav (NIH) | Drug interaction checking | 🔴 Planned |
| Philips / Mindray / GE | BLE vitals monitor integration | 🔴 Planned (V2.0) |

### Infrastructure
| Partner | Integration Type | Status |
|---|---|---|
| AWS Bahrain | Primary hosting | 🟡 Setup in progress |
| Oracle Cloud Jeddah | Backup / DR hosting | 🔴 Planned |

## Plugin Marketplace (Future)

Long-term vision: allow third-party developers to build plugins for the platform.

**Requirements for marketplace inclusion:**
- [ ] Passes SDAIA data classification review
- [ ] No PHI in logs or error reports
- [ ] FHIR R4 compliant data exchange
- [ ] Arabic/English RTL support for any UI components
- [ ] Integration test suite with >80% coverage
- [ ] Security audit passed

**Revenue model:** 80/20 split (developer/platform) on paid plugins.
