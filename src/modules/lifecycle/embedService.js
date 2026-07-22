import { db } from '../../db/index.js'
import { kftAdapter } from '../ingestion/adapters/kft/index.js'
import { encrypt, decrypt } from '../../shared/crypto.js'
import { appendAuditEvent } from '../compliance/auditLog.js'
import { leadsRepo } from '../leads/leadsRepo.js'
import { eligibilityService } from '../eligibility/eligibilityService.js'

// Orchestrates the KFT Token Handover flow:
// 1. Generate UTM  2. Generate Token  3. Record Consent  → return final journey URL
export const embedService = {
  initiate: async ({ lead, utmSource, utmMedium, utmCampaign }) => {
    const { id: leadId, mobile } = lead

    // Gate: run eligibility check before KFT handover
    const eligibility = await eligibilityService.checkLead(lead)
    if (!eligibility.eligible) {
      return {
        eligible: false,
        failures: eligibility.failures,
        score: eligibility.score,
        checkId: eligibility.checkId,
      }
    }

    return db.transaction(async (client) => {
      // Step 1: UTM generation — PartnerCustomerID header required per API spec
      const utmRes = await kftAdapter.generateUTM({ mobile, utmSource, utmMedium, utmCampaign, partnerCustomerId: leadId })
      const utmUrl = utmRes.Data.UTM
      const utmCode = new URL(utmUrl).searchParams.get('utm_code')

      // Step 2: Token generation — use leadId as PartnerCustomerID
      const tokenRes = await kftAdapter.generateToken({ partnerCustomerId: leadId })
      const { Token: authToken, RefreshToken: refreshToken, TokenValidTill: tokenValidTill } = tokenRes.Data

      // Step 3: Consent — token + PartnerCustomerID header required per API spec
      await kftAdapter.recordConsent({ mobile, token: authToken, partnerCustomerId: leadId })

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

      // Per KFT spec §1.8.1: AuthToken appended to UTM URL bypasses login screen.
      // Avoid double-appending if the real KFT API already embeds it in the UTM response.
      const parsedUtm = new URL(utmUrl)
      if (!parsedUtm.searchParams.has('AuthToken')) {
        parsedUtm.searchParams.set('AuthToken', authToken)
      }
      const journeyUrl = parsedUtm.toString()

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

  /**
   * Refresh an expired token for an existing KFT session.
   * Updates kft_sessions with new token + expiry in place.
   */
  refreshSession: async (sessionId, leadId) => {
    const { rows } = await db.query(
      `SELECT id, refresh_token, token_valid_till FROM kft_sessions WHERE id = $1 AND lead_id = $2`,
      [sessionId, leadId]
    )
    if (!rows[0]) throw new Error('KFT session not found')

    const session = rows[0]
    const tokenExpiry = new Date(session.token_valid_till)
    const isExpired = tokenExpiry <= new Date()

    if (!isExpired) {
      return { refreshed: false, tokenValidTill: session.token_valid_till }
    }

    const storedRefreshToken = decrypt(session.refresh_token)
    const tokenRes = await kftAdapter.refreshToken({ refreshToken: storedRefreshToken, partnerCustomerId: leadId })
    const { Token: newAuthToken, RefreshToken: newRefreshToken, TokenValidTill: newValidTill } = tokenRes.Data

    await db.query(
      `UPDATE kft_sessions SET auth_token = $1, refresh_token = $2, token_valid_till = $3 WHERE id = $4`,
      [encrypt(newAuthToken), encrypt(newRefreshToken), newValidTill, sessionId]
    )

    return { refreshed: true, tokenValidTill: newValidTill }
  },
}
