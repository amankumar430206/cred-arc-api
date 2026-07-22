export const up = async (db) => {
  await db.query(`
    CREATE TABLE eligibility_checks (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      status          TEXT NOT NULL CHECK (status IN ('eligible', 'ineligible', 'error')),
      score           INT,
      failures        JSONB NOT NULL DEFAULT '[]',
      bureau_response JSONB,
      checked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.query(`CREATE INDEX idx_eligibility_lead_id ON eligibility_checks(lead_id)`)
  await db.query(`CREATE INDEX idx_eligibility_lead_checked ON eligibility_checks(lead_id, checked_at DESC)`)
}

export const down = async (db) => {
  await db.query(`DROP TABLE IF EXISTS eligibility_checks`)
}
