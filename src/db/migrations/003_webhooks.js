export const up = async (db) => {
  await db.query(`
    CREATE TABLE kft_webhook_events (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type   TEXT NOT NULL,
      lead_id      UUID REFERENCES leads(id) ON DELETE SET NULL,
      session_id   UUID REFERENCES kft_sessions(id) ON DELETE SET NULL,
      payload      JSONB NOT NULL DEFAULT '{}',
      processed    BOOLEAN NOT NULL DEFAULT FALSE,
      received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)
  await db.query(`CREATE INDEX idx_webhook_lead_id ON kft_webhook_events(lead_id)`)
  await db.query(`CREATE INDEX idx_webhook_received ON kft_webhook_events(received_at DESC)`)
}

export const down = async (db) => {
  await db.query(`DROP TABLE IF EXISTS kft_webhook_events`)
}
