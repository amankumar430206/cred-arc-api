/**
 * Bureau hard filters for personal loan eligibility.
 *
 * Each rule receives a normalised BureauData object and returns a failure
 * message when the rule is violated, or null when it passes.
 *
 * BureauData shape:
 * {
 *   score:              number,   // TU CIBIL V3
 *   dpd30Last12Months:  number,   // count of 30+ DPD instances in last 12M
 *   dpd60Last24Months:  number,   // count of 60+ DPD instances in last 24M
 *   dpd90Last36Months:  number,   // count of 90+ DPD instances in last 36M
 *   dpd1Last3Months:    number,   // count of 01+ DPD instances in last 3M
 *   ecsBounces90Days:   number,   // ECS bounces in last 90 days
 *   hasLSS:             boolean,  // LSS flag in last 36M
 *   hasSMA:             boolean,  // SMA flag in last 36M
 *   hasDBT:             boolean,  // DBT flag in last 36M
 *   overdueAmount:      number,   // current overdue in INR (0 = nil)
 *   vintageMonths:      number,   // bureau vintage in months
 *   maxPLBLAmount:      number,   // maximum PL/BL sanctioned limit in INR
 *   enquiries60Days:    number,   // credit enquiries in last 60 days
 * }
 */

export const RULES = [
  {
    id: 'min_cibil_score',
    label: 'Minimum CIBIL score',
    description: 'TU CIBIL V3 score must be > 680',
    check: b => b.score > 680,
    reason: b => `CIBIL score ${b.score} is below the minimum of 680`,
  },
  {
    id: 'no_dpd_30_12m',
    label: 'No 30+ DPD (12 months)',
    description: 'No 30+ DPD in last 12 months',
    check: b => b.dpd30Last12Months === 0,
    reason: b => `${b.dpd30Last12Months} instance(s) of 30+ DPD found in the last 12 months`,
  },
  {
    id: 'no_dpd_60_24m',
    label: 'No 60+ DPD (24 months)',
    description: 'No 60+ DPD in last 24 months',
    check: b => b.dpd60Last24Months === 0,
    reason: b => `${b.dpd60Last24Months} instance(s) of 60+ DPD found in the last 24 months`,
  },
  {
    id: 'no_dpd_90_36m',
    label: 'No 90+ DPD (36 months)',
    description: 'No 90+ DPD in last 36 months',
    check: b => b.dpd90Last36Months === 0,
    reason: b => `${b.dpd90Last36Months} instance(s) of 90+ DPD found in the last 36 months`,
  },
  {
    id: 'no_dpd_1_3m',
    label: 'No 01+ DPD (3 months)',
    description: 'No 01+ DPD in last 3 months',
    check: b => b.dpd1Last3Months === 0,
    reason: b => `${b.dpd1Last3Months} instance(s) of 1+ DPD found in the last 3 months`,
  },
  {
    id: 'no_ecs_bounces_90d',
    label: 'No ECS bounces (90 days)',
    description: 'No ECS bounces in last 90 days',
    check: b => b.ecsBounces90Days === 0,
    reason: b => `${b.ecsBounces90Days} ECS bounce(s) found in the last 90 days`,
  },
  {
    id: 'nil_lss_sma_dbt',
    label: 'Nil LSS / SMA / DBT',
    description: 'Nil LSS/SMA/DBT in last 36 months',
    check: b => !b.hasLSS && !b.hasSMA && !b.hasDBT,
    reason: b => {
      const flags = [b.hasLSS && 'LSS', b.hasSMA && 'SMA', b.hasDBT && 'DBT'].filter(Boolean)
      return `${flags.join('/')} found in last 36 months`
    },
  },
  {
    id: 'no_overdue',
    label: 'No overdue amount',
    description: 'No current overdue amount on any account',
    check: b => b.overdueAmount === 0,
    reason: b => `Overdue amount of ₹${b.overdueAmount.toLocaleString('en-IN')} found`,
  },
  {
    id: 'bureau_vintage',
    label: 'Bureau vintage > 3 years',
    description: 'Credit bureau history must be older than 3 years',
    check: b => b.vintageMonths > 36,
    reason: b => `Bureau vintage is ${b.vintageMonths} months — minimum 36 months required`,
  },
  {
    id: 'min_pl_bl_limit',
    label: 'Min PL/BL > ₹5 lakhs',
    description: 'Minimum PL/BL sanctioned limit must exceed ₹5,00,000',
    check: b => b.maxPLBLAmount > 500000,
    reason: b => `Maximum PL/BL limit ₹${b.maxPLBLAmount.toLocaleString('en-IN')} is below ₹5,00,000`,
  },
  {
    id: 'enquiries_60d',
    label: 'Enquiries ≤ 10 (60 days)',
    description: 'Not more than 10 credit enquiries in last 60 days',
    check: b => b.enquiries60Days <= 10,
    reason: b => `${b.enquiries60Days} enquiries in last 60 days — maximum 10 allowed`,
  },
]

/**
 * Evaluate all hard filters against normalised bureau data.
 * Returns { eligible, score, failures[], rulesEvaluated }
 */
export function evaluateEligibility(bureauData) {
  const failures = []

  for (const rule of RULES) {
    if (!rule.check(bureauData)) {
      failures.push({
        rule: rule.id,
        label: rule.label,
        reason: rule.reason(bureauData),
      })
    }
  }

  return {
    eligible: failures.length === 0,
    score: bureauData.score,
    failures,
    rulesEvaluated: RULES.length,
  }
}
