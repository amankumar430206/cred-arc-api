import { createHash } from 'crypto'
import { db } from '../../db/index.js'

const hashEvent = (prevHash, payload) =>
  createHash('sha256')
    .update((prevHash ?? '') + JSON.stringify(payload))
    .digest('hex')

// Must be called inside an existing db transaction (pass the client).
// Every state mutation on a lead or KFT session calls this in the same txn.
export const appendAuditEvent = async (client, { orgId, actor, entityType, entityId, action, payload = {} }) => {
  const { rows } = await client.query(
    `SELECT hash FROM audit_events
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY created_at DESC LIMIT 1`,
    [entityType, entityId]
  )
  const prevHash = rows[0]?.hash ?? null
  const hash = hashEvent(prevHash, { actor, entityType, entityId, action, payload })

  await client.query(
    `INSERT INTO audit_events (org_id, actor, entity_type, entity_id, action, payload, prev_hash, hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [orgId ?? null, actor, entityType, entityId, action, payload, prevHash, hash]
  )
}

// Read-only helper for fetching audit trail of an entity
export const getAuditTrail = (entityType, entityId) =>
  db.query(
    `SELECT id, actor, action, payload, created_at
     FROM audit_events
     WHERE entity_type = $1 AND entity_id = $2
     ORDER BY created_at ASC`,
    [entityType, entityId]
  ).then(r => r.rows)
