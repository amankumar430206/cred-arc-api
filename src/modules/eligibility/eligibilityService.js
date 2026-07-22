import { db } from '../../db/index.js'
import { fetchBureauReport } from './bureauAdapter.js'
import { evaluateEligibility } from './rules.js'

export const eligibilityService = {
  /**
   * Run a full eligibility check for a lead.
   * Fetches bureau report → evaluates rules → persists result → returns outcome.
   *
   * @param {{ id: string, mobile: string, name?: string }} lead
   * @returns {Promise<{ eligible: boolean, score: number|null, failures: object[], checkId: string }>}
   */
  async checkLead(lead) {
    let status = 'error'
    let score = null
    let failures = []
    let bureauResponse = null

    try {
      const { bureauData, rawResponse } = await fetchBureauReport(lead)
      bureauResponse = rawResponse
      const result = evaluateEligibility(bureauData)

      status = result.eligible ? 'eligible' : 'ineligible'
      score = result.score
      failures = result.failures
    } catch (err) {
      failures = [{ rule: 'bureau_fetch', label: 'Bureau fetch', reason: err.message }]
    }

    const { rows } = await db.query(
      `INSERT INTO eligibility_checks (lead_id, status, score, failures, bureau_response)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, checked_at`,
      [lead.id, status, score, JSON.stringify(failures), JSON.stringify(bureauResponse)],
    )

    const check = rows[0]
    return {
      eligible: status === 'eligible',
      score,
      failures,
      status,
      checkId: check.id,
      checkedAt: check.checked_at,
    }
  },

  /**
   * Get the most recent eligibility result for a lead (no re-check).
   */
  async getLatest(leadId) {
    const { rows } = await db.query(
      `SELECT id, status, score, failures, checked_at
       FROM eligibility_checks
       WHERE lead_id = $1
       ORDER BY checked_at DESC
       LIMIT 1`,
      [leadId],
    )
    return rows[0] ?? null
  },
}
