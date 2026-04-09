# SKILLS.md — Skills for KSA Digital Health Development

## Active Skills

Skills installed and in use for this project. Reference their `SKILL.md` for usage details.

### Development & Architecture

| Skill | Use Case | Status |
|---|---|---|
| **frontend-design** | Building React dashboards with Arabic/English RTL support | ✅ Active |
| **optimize** | Performance tuning for NPHIES API response times | ✅ Active |
| **harden** | Error handling for claim submission edge cases | ✅ Active |
| **polish** | Final QA pass on UI components before demo | ✅ Active |

### Documentation & Communication

| Skill | Use Case | Status |
|---|---|---|
| **writing-assistant** | Sales materials, case studies, proposal writing | ✅ Active |
| **excel-xlsx** | ROI calculator spreadsheets for sales team | ✅ Active |
| **word-docx** | Formal proposals and compliance documentation | ✅ Active |
| **powerpoint-pptx** | Investor decks and facility presentation materials | ✅ Active |

### Data & Visualization

| Skill | Use Case | Status |
|---|---|---|
| **chart-image** | Generating claim rejection analytics charts, ROI visualizations | ✅ Active |
| **svg-draw** | Custom tooth charts (dental module), body maps (derma module) | ✅ Active |

### Operations

| Skill | Use Case | Status |
|---|---|---|
| **github** | PR management, issue tracking, CI/CD integration | ✅ Active |
| **self-improvement** | Capturing integration lessons learned, regulatory clarifications | ✅ Active |

## Needed But Not Yet Installed

| Skill | Use Case | Priority |
|---|---|---|
| **fhir-validator** | Validate FHIR R4 resource compliance before NPHIES submission | High |
| **arabic-nlp** | Arabic medical text processing for voice SOAP notes | Medium |
| **api-testing** | Automated NPHIES sandbox regression testing | High |
| **diagram-creator** | Architecture diagrams for stakeholder presentations | Medium |

## How to Find New Skills

```bash
# Search for available skills
clawhub search <keyword>

# Install a skill
clawhub install <skill-name>

# Update all installed skills
clawhub update --all
```

## Custom Skills (Project-Specific)

We should build these as project-specific skills:

### 1. `nphies-connector` (Priority: P0)
- Encapsulate NPHIES API interaction patterns
- Tameen (eligibility), Masdar (claims), Pre-Auth
- Handle token refresh, retry logic, error mapping
- Include sandbox/production environment switching

### 2. `fhir-mapper` (Priority: P0)
- Convert legacy PMS data formats to FHIR R4 resources
- Support: Patient, Encounter, Claim, ExplanationOfBenefit, Coverage
- Configurable mapping rules per PMS type
- Validation against NPHIES profiles

### 3. `cbahi-checker` (Priority: P1)
- Audit existing EMR data against CBAHI documentation standards
- Flag missing signatures, unsigned orders, incomplete vitals
- Generate readiness score
- Produce surveyor-ready reports

### 4. `claim-scrubber` (Priority: P0)
- Pre-submission validation against CCHI top-50 reject codes
- ICD-10 AM (AR-DRG) code validation
- ZATCA tax ID verification
- Batch processing for high-volume clinics

### 5. `demo-reset` (Priority: P1)
- Reset demo environments with fresh synthetic data
- One command: full demo ready for sales presentation
- Per-product demo data sets (polyclinic, hospital, specialty)
