import { db } from '../../db/index.js'
import { kftAdapter } from '../ingestion/adapters/kft/index.js'
import { encrypt, decrypt } from '../../shared/crypto.js'
import { appendAuditEvent } from '../compliance/auditLog.js'
import { leadsRepo } from '../leads/leadsRepo.js'

// Orchestrates the KFT Token Handover flow:
// 1. Generate UTM  2. Generate Token  3. Record Consent  → return final journey URL
export const embedService = {
  initiate: async ({ lead, utmSource, utmMedium, utmCampaign }) => {
    const { id: leadId, mobile } = lead

    return db.transaction(async (client) => {
      // Step 1: UTM generation
      const utmRes = await kftAdapter.generateUTM({ mobile, utmSource, utmMedium, utmCampaign })
      const utmUrl = utmRes.Data.UTM
      const utmCode = new URL(utmUrl).searchParams.get('utm_code')

      // Step 2: Token generation — use leadId as PartnerCustomerID
      const tokenRes = await kftAdapter.generateToken({ partnerCustomerId: leadId })
      const { Token: authToken, RefreshToken: refreshToken, TokenValidTill: tokenValidTill } = tokenRes.Data

      // Step 3: Consent
      await kftAdapter.recordConsent({ mobile, token: authToken })

      // Persist KFT session — tokens encrypted at rest
      const { rows } = await client.query(
        `INSERT INTO kft_sessions
           (lead_id, utm_code, auth_token, refresh_token, token_valid_till, consent_given, consent_at, status)
         VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), 'redirected')
         RETURNING id`,
        [leadId, utmCode, encrypt(authToken), encrypt(refreshToken), tokenValidTill]
      )
      const kftSessionId = rows[0].id

      // Advance lead status
      await leadsRepo.updateStatus(client, leadId, 'kft_redirected')

      // Audit
      await appendAuditEvent(client, {
        actor: 'system',
        entityType: 'lead',
        entityId: leadId,
        action: 'lead.kft_redirected',
        payload: { kftSessionId, utmCode },
      })

      // Build final journey URL — token appended client-side is NOT needed;
      // KFT validates via utm_code. AuthToken goes in URL for session bypass.
      const journeyUrl = `${utmUrl}&AuthToken=${encodeURIComponent(authToken)}`

      return { journeyUrl, utmCode, kftSessionId }
    })
  },

  getSession: async (leadId) => {
    const { rows } = await db.query(
      `SELECT id, utm_code, token_valid_till, consent_given, consent_at, status, created_at
       FROM kft_sessions WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [leadId]
    )
    return rows[0] ?? null
  },
}
