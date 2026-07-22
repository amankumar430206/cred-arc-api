import { db } from '../../db/index.js'
import { appendAuditEvent } from '../compliance/auditLog.js'

/**
 * Terminal KFT loan statuses → our lead status mapping.
 * KFT may send different event types; adjust as their webhook spec evolves.
 */
const KFT_STATUS_MAP = {
  loan_completed:    'completed',
  loan_disbursed:    'completed',
  application_dropped: 'dropped',
  loan_rejected:     'dropped',
}

export const webhookService = {
  /**
   * Process an inbound KFT webhook event.
   * Stores raw payload, updates kft_sessions + lead status if applicable.
   */
  async process(payload) {
    const { event_type, utm_code, lead_id: kftLeadRef } = payload

    // Look up session by utm_code (primary join key from KFT side)
    let sessionId = null
    let leadId = null

    if (utm_code) {
      const { rows } = await db.query(
        `SELECT id, lead_id FROM kft_sessions WHERE utm_code = $1 ORDER BY created_at DESC LIMIT 1`,
        [utm_code]
      )
      if (rows[0]) {
        sessionId = rows[0].id
        leadId = rows[0].lead_id
      }
    }

    // Persist raw event
    await db.query(
      `INSERT INTO kft_webhook_events (event_type, lead_id, session_id, payload, processed)
       VALUES ($1, $2, $3, $4, $5)`,
      [event_type ?? 'unknown', leadId, sessionId, JSON.stringify(payload), false]
    )

    if (!leadId || !sessionId) return { processed: false, reason: 'utm_code not matched' }

    const newLeadStatus = KFT_STATUS_MAP[event_type]

    await db.transaction(async (client) => {
      // Update KFT session status
      await client.query(
        `UPDATE kft_sessions SET status = $1 WHERE id = $2`,
        [event_type === 'loan_completed' || event_type === 'loan_disbursed' ? 'completed' : 'dropped', sessionId]
      )

      // Update lead status if it maps to a terminal state
      if (newLeadStatus) {
        await client.query(
          `UPDATE leads SET status = $1 WHERE id = $2 AND status NOT IN ('completed', 'dropped')`,
          [newLeadStatus, leadId]
        )
      }

      // Mark event processed
      await client.query(
        `UPDATE kft_webhook_events SET processed = TRUE WHERE lead_id = $1 AND session_id = $2 AND event_type = $3 AND processed = FALSE`,
        [leadId, sessionId, event_type]
      )

      // Audit
      await appendAuditEvent(client, {
        actor: 'kft_webhook',
        entityType: 'lead',
        entityId: leadId,
        action: `webhook.${event_type ?? 'unknown'}`,
        payload: { sessionId, utm_code, newLeadStatus },
      })
    })

    return { processed: true, leadId, sessionId, newLeadStatus }
  },
}
