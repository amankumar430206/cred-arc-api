# Lender Eligibility Criteria — KFT Personal Loan

Hard filters applied before any KFT redirect. All criteria must pass; a single failure rejects the application.

| # | Rule ID | Criterion | Threshold |
|---|---------|-----------|-----------|
| 1 | `min_cibil_score` | TU CIBIL V3 score | > 680 |
| 2 | `no_dpd_30_12m` | 30+ DPD in last 12 months | = 0 |
| 3 | `no_dpd_60_24m` | 60+ DPD in last 24 months | = 0 |
| 4 | `no_dpd_90_36m` | 90+ DPD in last 36 months | = 0 |
| 5 | `no_dpd_1_3m` | 01+ DPD in last 3 months | = 0 |
| 6 | `no_ecs_bounces_90d` | ECS bounces in last 90 days | = 0 |
| 7 | `nil_lss_sma_dbt` | LSS / SMA / DBT flags in last 36 months | None |
| 8 | `no_overdue` | Current overdue amount on any account | ₹0 |
| 9 | `bureau_vintage` | Credit bureau history age | > 36 months |
| 10 | `min_pl_bl_limit` | Maximum PL/BL sanctioned limit | > ₹5,00,000 |
| 11 | `enquiries_60d` | Credit enquiries in last 60 days | ≤ 10 |

## Implementation

- **Rule engine**: `src/modules/eligibility/rules.js` — pure functions, no side effects
- **Bureau adapter**: `src/modules/eligibility/bureauAdapter.js` — normalises TU CIBIL response; sandbox fixtures for QA
- **Service**: `src/modules/eligibility/eligibilityService.js` — fetches report, evaluates rules, persists to `eligibility_checks`
- **API**: `POST /v1/leads/:id/eligibility` — explicit check endpoint
- **Gate**: `embedService.initiate()` runs eligibility before KFT handover; returns `eligible: false` if rejected

## Sandbox behaviour

In `NODE_ENV !== 'production'` or `KFT_SANDBOX=true`, no real bureau API call is made.
- Mobile ending in **even digit** → eligible (CIBIL 750, clean profile)
- Mobile ending in **odd digit** → ineligible (CIBIL 620, multiple failures)

## Adding new criteria

1. Add a rule object to `RULES` array in `rules.js`
2. Ensure `bureauAdapter.normalizeBureauData()` maps the required field
3. Update sandbox fixtures if the new field needs a non-zero default
4. Update this document
