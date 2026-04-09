# KSA Digital Health Market Playbook — Execution Edition

> Transform strategic insight into shipped products and signed contracts.

---

## Executive Summary

**What this is:** A complete go-to-market playbook for entering the Saudi digital health market, targeting the ~200+ small-to-mid facilities in Riyadh struggling with NPHIES compliance, CBAHI accreditation, and operational inefficiency.

**Total Addressable Problem:** Facilities losing SAR 100K–500K annually to claim denials, manual workflows, and accreditation failures.

**Entry Strategy:** Don't sell HIS replacements. Sell **compliance connectors** and **workflow accelerators** that sit on top of legacy systems — low risk, fast value, monthly subscription.

---

## Part 1: Product Portfolio (What You're Actually Building)

### Product A: "NPHIES Survival Bridge" — Compliance Middleware

**What it is:** A lightweight integration layer that connects any existing PMS/EMR to NPHIES without replacing the core system.

#### Technical Specification

```
Architecture: Microservices (containerized)
Hosting: AWS Bahrain / Oracle Cloud Jeddah (SDAIA-compliant)
Stack:
  - Integration Engine: Apache Camel or Node-RED (HL7/FHIR routing)
  - API Gateway: Kong or AWS API Gateway
  - FHIR Server: HAPI FHIR R4 (open-source)
  - Database: PostgreSQL (encrypted at rest)
  - Message Queue: RabbitMQ (async claim processing)
  - Frontend: React dashboard (Arabic/English RTL)
```

#### Core Modules

| Module | Function | Integration Method |
|---|---|---|
| **Legacy Adapter** | Reads from flat-file exports, CSV, SQL databases, or HL7v2 feeds from existing PMS | File watcher + custom parsers per PMS type |
| **NPHIES Connector** | Real-time eligibility check (Tameen), claim submission (Masdar), pre-authorization | REST API → NPHIES sandbox → production |
| **ZATCA Tax Validator** | Ensures every claim has valid VAT registration, correct tax group | ZATCA e-invoicing API (Phase 2) |
| **ICD-10 AM Mapper** | Maps free-text diagnosis to AR-DRG codes for claim accuracy | NLP-assisted lookup table + manual override |
| **Claim Scrubber** | Pre-submission validation against CCHI top-50 reject codes | Rules engine (Drools or custom) |
| **Rejection Analyzer** | Dashboard showing rejection trends by code, payer, provider | Analytics layer with drill-down |

#### Pricing Model

| Tier | Monthly Fee (SAR) | Includes |
|---|---|---|
| **Starter** | 5,000 | Eligibility check + basic claim submission (up to 1,000 claims/mo) |
| **Growth** | 12,000 | Full scrubber + rejection analytics + ZATCA integration (up to 5,000 claims/mo) |
| **Enterprise** | 25,000+ | Multi-branch + custom payer rules + dedicated support |

**Performance-Linked Option:** 50% base fee + 5% of recovered denied claims (first 6 months). Reduces buyer risk to near zero.

#### Implementation Timeline

```
Week 1-2:  Discovery — map existing PMS data model, identify export format
Week 3-4:  Legacy Adapter — build parser for their specific PMS (most common: Accumed, Medware, Epic)
Week 5-6:  NPHIES Sandbox — test eligibility + claim flow in NPHIES sandbox
Week 7-8:  Parallel Run — shadow existing process, validate output
Week 9:    Go-Live — first real claims through the bridge
Week 10-12: Stabilization — fix edge cases, train staff
```

**Total time to revenue: 12 weeks per facility.**

---

### Product B: "FlowClinic Express" — Patient Flow Optimizer

**Target:** High-volume expatriate polyclinics (Batha/Manfuha cluster, 100-300 patients/day)

#### Technical Specification

```
Architecture: Progressive Web App (PWA) + WhatsApp Business API
Stack:
  - Kiosk App: React Native (Android tablets)
  - Backend: Node.js + Express
  - Queue Engine: Redis (real-time queue state)
  - WhatsApp: Twilio WhatsApp Business API or direct Cloud API
  - Voice-to-Text: Google Cloud STT (Arabic + English + Urdu)
  - Database: MongoDB (patient session data, ephemeral)
```

#### Core Modules

| Module | Function | Key Metric |
|---|---|---|
| **Multilingual Kiosk** | Self-registration on tablet: name, ID, chief complaint. Languages: Arabic, English, Urdu, Tagalog, Bengali, Hindi | Reduces registration time from 8 min → 2 min |
| **WhatsApp Queue** | Real-time queue position via WhatsApp link. Auto-updates every 60 seconds | Eliminates 40% of front-desk "where am I?" queries |
| **Voice SOAP Notes** | Doctor dictates in any supported language → structured SOAP note auto-generated | Saves 5-8 min per encounter on documentation |
| **Smart Billing** | Auto-generates NPHIES claim + ZATCA invoice from completed SOAP note | One-click submit, zero re-keying |

#### Pricing Model

| Tier | Monthly Fee (SAR) | Includes |
|---|---|---|
| **Basic** | 4,000 | Kiosk + Queue (up to 5 doctors) |
| **Full** | 9,000 | + Voice SOAP + Smart Billing (up to 10 doctors) |
| **Multi-Site** | 16,000+ | Unlimited doctors + analytics dashboard |

**ROI Hook:** "3 extra patients per doctor per day × SAR 150 avg visit = SAR 13,500/month additional revenue. System pays for itself in 3 weeks."

---

### Product C: "CBAHI Remediation Suite" — Accreditation Recovery

**Target:** Hospitals with Denial or Conditional CBAHI status

#### Technical Specification

```
Architecture: Modular add-on to existing HIS
Stack:
  - CDSS Engine: Python (drug interaction checks via RxNav API)
  - Audit Logger: Immutable append-only log (AWS QLDB or custom Merkle tree)
  - Vitals Integration: BLE gateway → EMR (Philips, Mindray, GE protocols)
  - Dashboard: React + Recharts (CBAHI readiness score)
```

#### Core Modules

| Module | Function | CBAHI Requirement Addressed |
|---|---|---|
| **Drug Interaction Alerting** | Real-time check against allergies + current meds at prescribing time | Patient Safety Standards |
| **Immutable Audit Trail** | Every data access, modification, deletion logged with timestamp + user ID | Data Integrity Standards |
| **Vital Signs Auto-Flow** | Bluetooth capture from bedside monitors → auto-populate nursing chart | Documentation Standards |
| **Missing Signature Detector** | Flags incomplete charts (unsigned orders, missing nursing notes) before patient discharge | Documentation Completeness |
| **CBAHI Readiness Dashboard** | Real-time score showing which standards are met, partially met, or missing | Survey Preparedness |

#### Pricing Model

| Tier | Monthly Fee (SAR) | Includes |
|---|---|---|
| **Remediation** | 18,000 | Full suite, focused on Denial → Conditional transition |
| **Compliance** | 22,000 | + Ongoing monitoring + survey preparation support |
| **Performance Bonus** | +50,000 | One-time payment upon successful CBAHI re-survey |

**Guarantee:** "90% reduction in Data Integrity citations within one survey cycle, or 3 months free."

---

### Product D: "Specialty Smart-Forms" — Vertical Modules

**Target:** Dental, Dermatology, Ophthalmology specialty centers

#### Dental Module
```
- Interactive 2D tooth chart (SVG-based, click-to-procedure)
- Auto-mapping: procedure → ADA/SNODENT code → NPHIES pre-auth
- Periapical X-ray viewer (DICOM lite)
- Treatment plan builder with patient-facing cost estimate
```

#### Dermatology Module
```
- Body map with photo overlay (encrypted, patient-consent gated)
- AI-assisted lesion tracking (compare before/after, flag changes)
- Dermoscopy image attachment to encounter note
- Prescription generator with formulary check
```

#### Ophthalmology Module
```
- Embedded DICOM viewer (cornerstone.js — browser-based, no plugin)
- OCT/HVF auto-import from device network
- Visual acuity logging with ETDRS standard
- Refraction workflow: auto-calculate lens prescription
```

**Pricing:** SAR 3,000–6,000/month per module (add-on to any base product).

---

## Part 2: Go-to-Market Execution

### Sales Team Structure (First 6 Months)

```
Team (6 people):
├── 1x Sales Lead (bilingual Arabic/English, healthcare IT background)
├── 2x Account Executives (one for clinics, one for hospitals)
├── 1x Solutions Engineer (does demos, handles technical objections)
├── 1x Implementation Specialist (on-site deployment)
└── 1x Customer Success (post-sale, reduces churn)
```

### Lead Prioritization Matrix

| Priority | Facility Type | Why Now | First Product |
|---|---|---|---|
| 🔴 **P0 — This Week** | CBAHI Denial hospitals (Victoria, Al Safwa, Al Azhar) | Bleeding money daily, urgency is existential | CBAHI Remediation Suite |
| 🟠 **P1 — This Month** | High-volume Batha clinics (New Safa Makkah, Dhaka Medical) | Manual processes = easy ROI story | FlowClinic Express |
| 🟡 **P2 — This Quarter** | Specialty centers with NPHIES gaps | Compliance deadline pressure | NPHIES Survival Bridge |
| 🟢 **P3 — Pipeline** | Mid-size hospitals with conditional CBAHI | Growing urgency as survey dates approach | Compliance tier |

### Outbound Cadence (Per Lead)

```
Day 1:  WhatsApp message (short, specific trigger reference)
Day 3:  Follow-up WhatsApp with 60-sec video demo link
Day 7:  Phone call (Solutions Engineer does a live 15-min screen share)
Day 14: On-site visit with printed ROI calculator (leave-behind)
Day 21: "Limited offer" — performance-linked pricing expires
Day 30: Last touch — share anonymized case study from similar facility
```

### Objection Handling Cheat Sheet

| Objection | Response |
|---|---|
| "We can't afford it" | "Our performance-linked model means you pay 50% until we prove ROI. If we don't save you money, you owe nothing extra." |
| "We're switching HIS next year" | "Perfect — our bridge works with your current system AND your future one. We handle the migration data mapping for free." |
| "Staff won't use it" | "We run in shadow mode for 2 weeks. Your staff never touches the new system until they've seen it work flawlessly alongside their current process." |
| "We tried a digital solution before and it failed" | "What specifically failed? [Listen.] We solve exactly that — here's how [specific module demo]." |
| "Our IT guy says we can build this ourselves" | "You could. It'll take 8-12 months and SAR 400K+. We're live in 8 weeks for SAR 5K/month. What's the cost of waiting?" |

---

## Part 3: Implementation Playbook

### Phase 1 — Discovery (Weeks 1-2)

**Deliverables:**
- [ ] Current system inventory (PMS name, version, database type)
- [ ] Data flow map (where does patient data live, how does it move?)
- [ ] Integration pain points document (top 10 manual workarounds)
- [ ] NPHIES readiness score (what's connected, what's not)
- [ ] Staff digital literacy assessment (1-5 scale per role)

**Tools:**
- Discovery questionnaire (Google Form, bilingual)
- On-site observation checklist (shadow staff for 1 day)
- PMS database schema extraction script

### Phase 2 — Integration Build (Weeks 3-6)

**Deliverables:**
- [ ] Legacy adapter for their specific PMS (tested with real data export)
- [ ] NPHIES sandbox integration (eligibility + claim submission verified)
- [ ] Custom rules configuration (their top rejection codes loaded)
- [ ] Staff-facing components configured (kiosk, dashboard, alerts)

**Key Risk:** PMS vendor cooperation. Some vendors (especially legacy on-prem) won't provide API access.
**Mitigation:** Use database-level read access (ask facility IT, not vendor). Or file-export polling (most PMS can export CSV/HL7 to a shared folder).

### Phase 3 — Parallel Run (Weeks 7-8)

**The "Shadow Mode" Protocol:**
1. New system runs alongside existing process
2. Staff continues their normal workflow
3. System generates a comparison report: "Here's what would have been different"
4. Focus metrics:
   - Claims that would have been rejected (but were caught by scrubber)
   - Time saved on eligibility checks
   - Documentation completeness score
5. End of Week 8: Show the facility manager the report. This is your go-live conversion moment.

### Phase 4 — Go-Live (Week 9)

**Checklist:**
- [ ] Staff trained (2-hour session per role, with cheat sheets in their language)
- [ ] Escalation path defined (who to call, response time SLA)
- [ ] Rollback plan (can revert to old process within 4 hours if critical failure)
- [ ] Success metrics baseline captured (for 90-day review)

### Phase 5 — Stabilization (Weeks 10-12)

**Activities:**
- Daily check-in calls (Week 10), then weekly (Weeks 11-12)
- Bug fix sprint (inevitable edge cases with their specific data)
- First monthly business review: "Here's your ROI so far"

---

## Part 4: Technical Foundation

### Regulatory Compliance Checklist

- [ ] **SDAIA Data Classification:** All patient data classified as "Sensitive" — encrypted at rest (AES-256) and in transit (TLS 1.3)
- [ ] **NPHIES Technical Standards:** FHIR R4, SMART on FHIR for auth, RESTful API patterns
- [ ] **ZATCA Phase 2:** e-Invoice XML format, cryptographic stamp integration
- [ ] **CCHI Requirements:** Claim format compliance, rejection code handling
- [ ] **Data Residency:** All data stored within KSA borders (AWS Bahrain region or Oracle Jeddah)
- [ ] **Consent Management:** Patient consent capture for data sharing (PDPL compliance)

### Core API Integrations

```
Priority 1 (MVP):
  ├── NPHIES API (eligibility, claims, pre-auth)
  ├── ZATCA API (e-invoicing)
  └── WhatsApp Business API (patient notifications)

Priority 2 (V1.1):
  ├── RxNav API (drug interaction checking)
  ├── Google Cloud STT (voice-to-text)
  └── SMS Gateway (local: Unifonic or Slaicom)

Priority 3 (V2.0):
  ├── DICOM integration (imaging devices)
  ├── BLE/HL7 FHIR Device (vitals monitors)
  └── AI/ML services (lesion tracking, claim prediction)
```

### Infrastructure Cost Estimate (Monthly)

```
AWS Bahrain (or equivalent):
  ├── Compute (EKS cluster, 3 nodes):        $800
  ├── Database (RDS PostgreSQL, Multi-AZ):    $400
  ├── Storage (S3 + encrypted backups):       $150
  ├── API Gateway + CDN:                      $200
  ├── Monitoring (Datadog or CloudWatch):     $100
  ├── WhatsApp API (Twilio, ~5K msgs/mo):     $250
  └── SSL + Domain + Security:                $100
                                  ─────────────────
  Total infra per facility:                   ~$2,000/mo
  At 20 facilities:                           ~$100/unit/mo (economies of scale)
```

---

## Part 5: 90-Day Sprint Plan

### Month 1: Foundation

- [ ] Register KSA entity (or partner with local distributor)
- [ ] Set up SDAIA-compliant cloud infrastructure
- [ ] NPHIES sandbox integration complete (eligibility + claims)
- [ ] Build Legacy Adapter v1 (support top 3 PMS in Riyadh: Accumed, Medware, Cerner)
- [ ] Hire Sales Lead + Solutions Engineer
- [ ] Secure 3 pilot facilities (ideally: 1 Denial hospital + 2 Batha clinics)

### Month 2: Pilot

- [ ] Deploy Product A (NPHIES Bridge) at all 3 pilots
- [ ] Deploy Product B (FlowClinic) at 1 clinic pilot
- [ ] Begin shadow mode at CBAHI Denial hospital
- [ ] Collect first ROI data points
- [ ] Build case study materials (with anonymized data)
- [ ] Refine pricing based on pilot feedback

### Month 3: Scale

- [ ] Convert pilots to paying customers
- [ ] Launch outbound sales to P0/P1 priority list (target: 10 facilities)
- [ ] Publish first case study
- [ ] Begin Product C (CBAHI Suite) development based on pilot learnings
- [ ] Hire remaining team members
- [ ] Target: 10 active facilities, SAR 100K+ MRR

---

## Part 6: Competitive Differentiation

### Why Not Epic/Cerner/Medical Information Technology?

| Factor | Global Vendors | This Playbook |
|---|---|---|
| **Price** | SAR 500K–2M upfront | SAR 5K–25K/month |
| **Deployment** | 6–18 months | 8–12 weeks |
| **Risk** | Full replacement (high) | Add-on (low) |
| **Local Support** | Regional office, ticket queue | On-site, Arabic-first |
| **Target Market** | Large hospitals (200+ beds) | Small-mid facilities (10–150 beds) |
| **NPHIES Focus** | Checkbox feature | Core product |

### Why Not Local Startups?

Most local health-tech startups are building **full HIS replacements** (competing with Epic) or **patient-facing apps** (competing for consumer attention). Nobody is building the **unglamorous middleware layer** that actually solves the compliance problem for the 80% of facilities that can't afford or don't need a full HIS.

That's the gap. That's the product.

---

## Appendix: Key Terms & Acronyms

| Term | Meaning |
|---|---|
| **NPHIES** | National Platform for Health Insurance Exchange Services |
| **CBAHI** | Saudi Central Board for Accreditation of Healthcare Institutions |
| **ZATCA** | Zakat, Tax and Customs Authority (e-invoicing) |
| **CCHI** | Council of Cooperative Health Insurance |
| **AR-DRG** | Australian Refined Diagnosis Related Groups (used in KSA claims) |
| **SDAIA** | Saudi Data and AI Authority (data governance) |
| **PDPL** | Personal Data Protection Law (KSA privacy regulation) |
| **Tameen** | NPHIES eligibility verification service |
| **Masdar** | NPHIES claims submission service |
| **FHIR** | Fast Healthcare Interoperability Resources (HL7 standard) |

---

*Playbook Version 1.0 — April 2026*
*Ready for team review and execution.*
