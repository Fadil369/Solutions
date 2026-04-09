# BOOTSTRAP.md — Project Kickoff

_You're starting work on the KSA Digital Health Platform. Time to get oriented._

## What We're Building

Four products targeting Saudi Arabia's fragmented healthcare IT market:

1. **NPHIES Survival Bridge** — Middleware connecting legacy PMS to NPHIES (compliance)
2. **FlowClinic Express** — Patient flow for high-volume expatriate polyclinics
3. **CBAHI Remediation Suite** — Accreditation recovery for denied/conditional hospitals
4. **Specialty Smart-Forms** — Vertical modules (Dental, Derma, Ophthalmology)

## First Steps (Do These in Order)

### 1. Orient Yourself
Read these files:
- [ ] `SOUL.md` — who you are in this project
- [ ] `AGENTS.md` — project conventions and file structure
- [ ] `USER.md` — stakeholder context
- [ ] `TOOLS.md` — tech stack and environment notes
- [ ] `ksa-digital-health-playbook.md` — the full execution playbook (this is your source of truth)

### 2. Set Up Your Environment
- [ ] Confirm access to NPHIES sandbox (check credentials in your local `.env` — never commit these)
- [ ] Verify Docker and Kubernetes tooling is available
- [ ] Clone/create the repo structure from AGENTS.md file organization
- [ ] Run the synthetic data generator for demo environments

### 3. Validate the Playbook
- [ ] Review pricing tiers — do they still make sense for the current market?
- [ ] Confirm top-3 PMS targets (Accumed, Medware, Cerner) — are these still the most common in Riyadh?
- [ ] Check NPHIES API documentation for any changes since playbook was written
- [ ] Verify ZATCA Phase 2 timeline — is it still aligned with our launch window?

### 4. Build Your First Integration
Start with **Product A (NPHIES Survival Bridge)** — it's the foundation everything else builds on:
- [ ] Set up HAPI FHIR R4 server
- [ ] Build the first Legacy Adapter (start with the PMS you have sandbox access to)
- [ ] Hit NPHIES sandbox for a test eligibility check
- [ ] Get a test claim through the system end-to-end

### 5. Identify Your First 3 Pilots
Target profile:
- 1 CBAHI Denial hospital (urgency = existential)
- 2 Batha/Manfuha polyclinics (volume = easy ROI demo)
- Reference the lead prioritization matrix in the playbook

## When You're Done Onboarding

- [ ] Update `USER.md` with actual stakeholder names and contacts
- [ ] Update `TOOLS.md` with your specific environment details (PMS names, sandbox URLs, etc.)
- [ ] Delete this file — you don't need a kickoff script once you're running
- [ ] Start logging daily in `memory/YYYY-MM-DD.md`

## Success Criteria (First 90 Days)

| Metric | Target |
|---|---|
| NPHIES sandbox integration | End-to-end working |
| Pilot facilities signed | 3 |
| Legacy adapters built | 3 (one per top PMS) |
| First paying customer | 1 |
| MRR | SAR 100K+ |

---

_The playbook has the strategy. This file gets you moving on execution. Go._
