export const up = async (db) => {
  // Orgs (multi-tenancy)
  await db.query(`
    CREATE TABLE orgs (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL,
      type        TEXT NOT NULL DEFAULT 'lender' CHECK (type IN ('lender', 'platform')),
      whitelabel_config JSONB NOT NULL DEFAULT '{}',
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  // Admin users (CredArc internal team)
  await db.query(`
    CREATE TABLE admin_users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('super_admin', 'admin', 'viewer')),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    )
  `)

  // Leads — captured from myntpe.com redirect to onboarding
  await db.query(`
    CREATE TABLE leads (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id       UUID REFERENCES orgs(id),
      name         TEXT,
      mobile       TEXT NOT NULL,          -- encrypted at app layer
      mobile_hash  TEXT NOT NULL,          -- sha256 for lookups
      ref_source   TEXT DEFAULT 'myntpe',
      utm_source   TEXT,
      utm_medium   TEXT,
      utm_campaign TEXT,
      status       TEXT NOT NULL DEFAULT 'captured'
                   CHECK (status IN (
                     'captured', 'otp_sent', 'otp_verified',
                     'kft_redirected', 'completed', 'dropped'
                   )),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await db.query(`CREATE INDEX leads_mobile_hash_idx ON leads (mobile_hash)`)
  await db.query(`CREATE INDEX leads_status_idx ON leads (status)`)
  await db.query(`CREATE INDEX leads_created_at_idx ON leads (created_at DESC)`)

  // OTP sessions
  await db.query(`
    CREATE TABLE otp_sessions (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id     UUID NOT NULL REFERENCES leads(id),
      mobile_hash TEXT NOT NULL,
      code_hash   TEXT NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      verified    BOOLEAN NOT NULL DEFAULT FALSE,
      attempts    INT NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  // KFT sessions
  await db.query(`
    CREATE TABLE kft_sessions (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      lead_id          UUID NOT NULL REFERENCES leads(id),
      utm_code         TEXT,
      auth_token       TEXT,            -- encrypted at app layer
      refresh_token    TEXT,            -- encrypted at app layer
      token_valid_till TIMESTAMPTZ,
      consent_given    BOOLEAN NOT NULL DEFAULT FALSE,
      consent_at       TIMESTAMPTZ,
      status           TEXT NOT NULL DEFAULT 'initiated'
                       CHECK (status IN ('initiated', 'redirected', 'completed', 'expired')),
      created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  // Audit log — append-only, hash-chained, never UPDATE or DELETE
  await db.query(`
    CREATE TABLE audit_events (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id      UUID,
      actor       TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id   TEXT NOT NULL,
      action      TEXT NOT NULL,
      payload     JSONB NOT NULL DEFAULT '{}',
      prev_hash   TEXT,
      hash        TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await db.query(`CREATE INDEX audit_events_entity_idx ON audit_events (entity_type, entity_id)`)
  await db.query(`CREATE INDEX audit_events_created_at_idx ON audit_events (created_at DESC)`)
}

export const down = async (db) => {
  await db.query(`DROP TABLE IF EXISTS audit_events`)
  await db.query(`DROP TABLE IF EXISTS kft_sessions`)
  await db.query(`DROP TABLE IF EXISTS otp_sessions`)
  await db.query(`DROP TABLE IF EXISTS leads`)
  await db.query(`DROP TABLE IF EXISTS admin_users`)
  await db.query(`DROP TABLE IF EXISTS orgs`)
}
