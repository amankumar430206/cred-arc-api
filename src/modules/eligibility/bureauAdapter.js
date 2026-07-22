/**
 * Bureau adapter — abstracts TransUnion CIBIL (or any bureau) behind a common interface.
 *
 * normalizeBureauData(rawResponse) → BureauData
 * fetchBureauReport(lead)          → BureauData
 *
 * In sandbox mode (KFT_SANDBOX=true or NODE_ENV !== 'production') the adapter
 * returns fixture data without making a real API call.
 */

const IS_SANDBOX = process.env.KFT_SANDBOX === 'true' || process.env.NODE_ENV !== 'production'

// ── Sandbox fixtures ───────────────────────────────────────────────────────────

/** Fixture that passes all 11 hard filters — represents a clean profile */
export const SANDBOX_ELIGIBLE = {
  score: 750,
  dpd30Last12Months: 0,
  dpd60Last24Months: 0,
  dpd90Last36Months: 0,
  dpd1Last3Months: 0,
  ecsBounces90Days: 0,
  hasLSS: false,
  hasSMA: false,
  hasDBT: false,
  overdueAmount: 0,
  vintageMonths: 60,
  maxPLBLAmount: 800000,
  enquiries60Days: 3,
}

/** Fixture that fails multiple filters — represents a rejected profile */
export const SANDBOX_INELIGIBLE = {
  score: 620,
  dpd30Last12Months: 2,
  dpd60Last24Months: 1,
  dpd90Last36Months: 0,
  dpd1Last3Months: 1,
  ecsBounces90Days: 1,
  hasLSS: false,
  hasSMA: true,
  hasDBT: false,
  overdueAmount: 15000,
  vintageMonths: 24,
  maxPLBLAmount: 300000,
  enquiries60Days: 15,
}

/**
 * Deterministic sandbox routing — mobile numbers ending in odd digit → ineligible.
 * This lets QA test both paths with predictable inputs.
 */
function sandboxFixture(mobile) {
  const lastDigit = parseInt(String(mobile).slice(-1), 10)
  return lastDigit % 2 !== 0 ? SANDBOX_INELIGIBLE : SANDBOX_ELIGIBLE
}

// ── Normaliser ─────────────────────────────────────────────────────────────────

/**
 * Normalise a raw TransUnion CIBIL API response to the internal BureauData shape.
 * Adjust field mappings when integrating the real API.
 */
export function normalizeBureauData(raw) {
  // TODO: map actual CIBIL API response fields here
  return {
    score:              raw.score ?? raw.CreditScore ?? 0,
    dpd30Last12Months:  raw.dpd30Last12Months  ?? 0,
    dpd60Last24Months:  raw.dpd60Last24Months  ?? 0,
    dpd90Last36Months:  raw.dpd90Last36Months  ?? 0,
    dpd1Last3Months:    raw.dpd1Last3Months    ?? 0,
    ecsBounces90Days:   raw.ecsBounces90Days   ?? 0,
    hasLSS:             raw.hasLSS  ?? false,
    hasSMA:             raw.hasSMA  ?? false,
    hasDBT:             raw.hasDBT  ?? false,
    overdueAmount:      raw.overdueAmount  ?? 0,
    vintageMonths:      raw.vintageMonths  ?? 0,
    maxPLBLAmount:      raw.maxPLBLAmount  ?? 0,
    enquiries60Days:    raw.enquiries60Days ?? 0,
  }
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Fetch a bureau report for a lead and return normalised BureauData.
 *
 * @param {{ mobile: string, name?: string, pan?: string }} lead
 * @returns {Promise<{ bureauData: BureauData, rawResponse: object }>}
 */
export async function fetchBureauReport(lead) {
  if (IS_SANDBOX) {
    const bureauData = sandboxFixture(lead.mobile)
    return { bureauData, rawResponse: bureauData }
  }

  // TODO: replace with real TransUnion CIBIL API call
  // const res = await fetch(process.env.CIBIL_API_URL, {
  //   method: 'POST',
  //   headers: { Authorization: `Bearer ${process.env.CIBIL_API_KEY}`, 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ mobile: lead.mobile, name: lead.name, pan: lead.pan }),
  // })
  // if (!res.ok) throw new Error(`Bureau API error: ${res.status}`)
  // const raw = await res.json()
  // return { bureauData: normalizeBureauData(raw), rawResponse: raw }

  throw new Error('Real bureau API not configured — set CIBIL_API_URL and CIBIL_API_KEY')
}
