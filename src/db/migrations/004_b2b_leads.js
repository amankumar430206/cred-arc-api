export const up = async (db) => {
  await db.query(`
    CREATE TABLE b2b_leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

      -- Company details
      company_name          TEXT NOT NULL,
      industry              TEXT NOT NULL,
      incorporation_date    TEXT NOT NULL,
      gst_number            TEXT,

      -- Director details
      director_name         TEXT NOT NULL,
      mobile                TEXT NOT NULL,
      email                 TEXT NOT NULL,
      id_number             TEXT,
      id_type               TEXT CHECK (id_type IN ('aadhaar', 'pan')),

      -- Business metrics
      client_count          INT,
      invoices_per_month    INT,
      avg_billing_cycle_days INT,
      avg_bill_value        NUMERIC,
      annual_turnover       NUMERIC,

      -- Financing requirements
      required_amount       NUMERIC,
      financing_type        TEXT,

      -- Documents (stored as {name, size, type, data} base64 JSON)
      incorporation_cert    JSONB,
      company_deck          JSONB,

      -- Admin workflow
      status        TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN ('new', 'reviewing', 'approved', 'rejected', 'on_hold')),
      admin_notes   TEXT,

      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await db.query(`CREATE INDEX b2b_leads_status_idx ON b2b_leads(status)`)
  await db.query(`CREATE INDEX b2b_leads_created_at_idx ON b2b_leads(created_at DESC)`)
}
