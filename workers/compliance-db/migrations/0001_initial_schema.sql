-- Migration 0001: Initial schema for HealthBridge Compliance DB
-- Applied via: wrangler d1 migrations apply COMPLIANCE_DB

-- ─── Facilities ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facilities (
  id            TEXT PRIMARY KEY,                  -- facility UUID
  name          TEXT NOT NULL,
  name_ar       TEXT,                              -- Arabic name
  license_no    TEXT,                              -- MOH/CCHI license
  region        TEXT,                              -- Riyadh / Jeddah / etc.
  bed_count     INTEGER,
  cbahi_status  TEXT DEFAULT 'Unknown',            -- Unknown | Denial | Conditional | Accredited
  nphies_code   TEXT,                              -- NPHIES facility code
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─── CBAHI Findings ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cbahi_findings (
  id              TEXT PRIMARY KEY,
  facility_id     TEXT NOT NULL REFERENCES facilities(id),
  standard_code   TEXT NOT NULL,                  -- e.g. "MMS.1", "PCI.2"
  domain          TEXT NOT NULL,                  -- Patient Safety | Medication | Documentation | etc.
  description     TEXT NOT NULL,
  severity        TEXT NOT NULL DEFAULT 'Major',  -- Critical | Major | Minor | Observation
  status          TEXT NOT NULL DEFAULT 'Open',   -- Open | In-Progress | Resolved | Verified
  assignee        TEXT,
  evidence_key    TEXT,                           -- R2 object key for uploaded evidence
  due_date        TEXT,
  resolved_at     TEXT,
  notes           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_findings_facility ON cbahi_findings(facility_id);
CREATE INDEX IF NOT EXISTS idx_findings_status ON cbahi_findings(status);
CREATE INDEX IF NOT EXISTS idx_findings_domain ON cbahi_findings(domain);

-- ─── Claim Records ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS claim_records (
  id              TEXT PRIMARY KEY,               -- internal claim UUID
  facility_id     TEXT NOT NULL REFERENCES facilities(id),
  nphies_ref      TEXT,                           -- NPHIES transaction reference
  patient_id      TEXT,
  insurer_code    TEXT,
  claim_type      TEXT,                           -- institutional | professional | oral | vision | pharmacy
  total_amount    REAL,
  currency        TEXT DEFAULT 'SAR',
  status          TEXT NOT NULL DEFAULT 'submitted', -- submitted | processing | approved | rejected | appealed
  rejection_code  TEXT,
  rejection_reason TEXT,
  submitted_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_claims_facility ON claim_records(facility_id);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claim_records(status);
CREATE INDEX IF NOT EXISTS idx_claims_nphies ON claim_records(nphies_ref);

-- ─── Audit Log ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  facility_id TEXT,
  action      TEXT NOT NULL,                      -- CREATE | UPDATE | DELETE | LOGIN | etc.
  resource    TEXT,                               -- findings | claims | documents | sessions
  resource_id TEXT,
  actor       TEXT,                               -- user ID or 'system'
  ip_address  TEXT,
  details     TEXT,                               -- JSON blob of additional context
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_facility ON audit_log(facility_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- ─── Readiness Scores ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS readiness_scores (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  facility_id     TEXT NOT NULL REFERENCES facilities(id),
  score           INTEGER NOT NULL,               -- 0-100
  total_findings  INTEGER NOT NULL,
  resolved        INTEGER NOT NULL,
  pending         INTEGER NOT NULL,
  critical_open   INTEGER NOT NULL DEFAULT 0,
  predicted_status TEXT,                          -- Denial | Conditional | Accredited
  calculated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scores_facility ON readiness_scores(facility_id);
