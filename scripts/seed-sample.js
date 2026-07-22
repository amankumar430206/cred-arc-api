/**
 * seed-sample.js — Seeds realistic sample leads covering all statuses,
 * eligibility outcomes, KFT session states, and audit trails.
 *
 * Usage:  node scripts/seed-sample.js
 * Safe to re-run — clears existing sample data (leads where ref_source = 'seed') first.
 */

import 'dotenv/config'
import { createHash } from 'crypto'
import { db } from '../src/db/index.js'
import { encrypt } from '../src/shared/crypto.js'

// ── Helpers ────────────────────────────────────────────────────────────────────

const hash = v => createHash('sha256').update(String(v)).digest('hex')

const hashEvent = (prevHash, payload) =>
  createHash('sha256').update((prevHash ?? '') + JSON.stringify(payload)).digest('hex')

async function auditEvent(client, { entityId, actor, action, payload = {}, createdAt }) {
  const { rows } = await client.query(
    `SELECT hash FROM audit_events WHERE entity_type = 'lead' AND entity_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [entityId]
  )
  const prevHash = rows[0]?.hash ?? null
  const h = hashEvent(prevHash, { actor, entityType: 'lead', entityId, action, payload })
  await client.query(
    `INSERT INTO audit_events (org_id, actor, entity_type, entity_id, action, payload, prev_hash, hash, created_at)
     VALUES (NULL, $1, 'lead', $2, $3, $4, $5, $6, $7)`,
    [actor, entityId, action, payload, prevHash, h, createdAt ?? new Date()]
  )
}

const ago = (mins) => new Date(Date.now() - mins * 60 * 1000)
const fakeMobile = (n) => `9${String(n).padStart(9, '0')}`  // 9000000001 etc

// ── Scenarios ──────────────────────────────────────────────────────────────────

const SCENARIOS = [
  // 1. Just captured — no OTP yet
  {
    name: 'Priya Sharma',     mobile: fakeMobile(1), status: 'captured',
    utm_source: 'google',     utm_medium: 'cpc', utm_campaign: 'personal_loan_q1',
    createdMinsAgo: 5,
    audit: [
      { actor: 'system', action: 'lead.created', minsAgo: 5 },
    ],
  },

  // 2. OTP sent, not yet verified
  {
    name: 'Rahul Verma',      mobile: fakeMobile(2), status: 'otp_sent',
    utm_source: 'facebook',   utm_medium: 'social', utm_campaign: 'loan_june',
    createdMinsAgo: 12,
    audit: [
      { actor: 'system',  action: 'lead.created',  minsAgo: 12 },
      { actor: 'system',  action: 'otp.sent',       minsAgo: 11 },
    ],
  },

  // 3. OTP verified — eligible, waiting for user to proceed
  {
    name: 'Anita Desai',      mobile: fakeMobile(3), status: 'otp_verified',
    utm_source: 'sms',        utm_medium: 'campaign', utm_campaign: 'pre_approved',
    createdMinsAgo: 30,
    audit: [
      { actor: 'system',  action: 'lead.created',    minsAgo: 30 },
      { actor: 'system',  action: 'otp.sent',         minsAgo: 29 },
      { actor: 'customer',action: 'otp.verified',     minsAgo: 27 },
    ],
    eligibility: {
      status: 'eligible', score: 762,
      failures: [],
      checkedMinsAgo: 27,
    },
  },

  // 4. OTP verified — ineligible (low score + DPD)
  {
    name: 'Suresh Nair',      mobile: fakeMobile(4), status: 'otp_verified',
    utm_source: 'whatsapp',   utm_medium: 'campaign', utm_campaign: 'loan_offer',
    createdMinsAgo: 45,
    audit: [
      { actor: 'system',  action: 'lead.created',    minsAgo: 45 },
      { actor: 'system',  action: 'otp.sent',         minsAgo: 44 },
      { actor: 'customer',action: 'otp.verified',     minsAgo: 42 },
    ],
    eligibility: {
      status: 'ineligible', score: 612,
      failures: [
        { rule: 'min_cibil_score', label: 'Minimum CIBIL score', reason: 'CIBIL score 612 is below the minimum of 680' },
        { rule: 'no_dpd_30_12m',   label: 'No 30+ DPD (12 months)', reason: '2 instance(s) of 30+ DPD found in the last 12 months' },
        { rule: 'no_dpd_1_3m',     label: 'No 01+ DPD (3 months)', reason: '1 instance(s) of 1+ DPD found in the last 3 months' },
      ],
      checkedMinsAgo: 41,
    },
  },

  // 5. KFT redirected — session active, token valid
  {
    name: 'Deepika Iyer',     mobile: fakeMobile(5), status: 'kft_redirected',
    utm_source: 'email',      utm_medium: 'newsletter', utm_campaign: 'aug_offers',
    createdMinsAgo: 90,
    audit: [
      { actor: 'system',  action: 'lead.created',        minsAgo: 90 },
      { actor: 'system',  action: 'otp.sent',             minsAgo: 89 },
      { actor: 'customer',action: 'otp.verified',         minsAgo: 87 },
      { actor: 'system',  action: 'lead.kft_redirected',  minsAgo: 86 },
    ],
    eligibility: {
      status: 'eligible', score: 735,
      failures: [],
      checkedMinsAgo: 87,
    },
    kftSession: {
      utmCode: 'UTM-20260612-SEED001',
      status: 'redirected',
      tokenValidTill: new Date(Date.now() + 29 * 24 * 60 * 60 * 1000), // 29 days from now
      consentGiven: true,
    },
  },

  // 6. KFT redirected — session active, token EXPIRED
  {
    name: 'Karthik Menon',    mobile: fakeMobile(6), status: 'kft_redirected',
    utm_source: 'push',       utm_medium: 'app', utm_campaign: 'retention',
    createdMinsAgo: 60 * 24 * 35, // 35 days ago
    audit: [
      { actor: 'system',  action: 'lead.created',        minsAgo: 60 * 24 * 35 },
      { actor: 'system',  action: 'otp.sent',             minsAgo: 60 * 24 * 35 - 1 },
      { actor: 'customer',action: 'otp.verified',         minsAgo: 60 * 24 * 35 - 5 },
      { actor: 'system',  action: 'lead.kft_redirected',  minsAgo: 60 * 24 * 35 - 8 },
    ],
    eligibility: {
      status: 'eligible', score: 701,
      failures: [],
      checkedMinsAgo: 60 * 24 * 35 - 5,
    },
    kftSession: {
      utmCode: 'UTM-20260510-SEED002',
      status: 'redirected',
      tokenValidTill: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // expired 5 days ago
      consentGiven: true,
    },
  },

  // 7. Completed — loan disbursed
  {
    name: 'Meera Pillai',     mobile: fakeMobile(7), status: 'completed',
    utm_source: 'google',     utm_medium: 'cpc', utm_campaign: 'branded',
    createdMinsAgo: 60 * 24 * 10, // 10 days ago
    audit: [
      { actor: 'system',       action: 'lead.created',         minsAgo: 60 * 24 * 10 },
      { actor: 'system',       action: 'otp.sent',              minsAgo: 60 * 24 * 10 - 1 },
      { actor: 'customer',     action: 'otp.verified',          minsAgo: 60 * 24 * 10 - 3 },
      { actor: 'system',       action: 'lead.kft_redirected',   minsAgo: 60 * 24 * 10 - 5 },
      { actor: 'kft_webhook',  action: 'webhook.loan_disbursed',minsAgo: 60 * 24 * 8 },
    ],
    eligibility: {
      status: 'eligible', score: 788,
      failures: [],
      checkedMinsAgo: 60 * 24 * 10 - 3,
    },
    kftSession: {
      utmCode: 'UTM-20260625-SEED003',
      status: 'completed',
      tokenValidTill: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
      consentGiven: true,
    },
  },

  // 8. Dropped — ineligible shown, user left
  {
    name: 'Vijay Kulkarni',   mobile: fakeMobile(8), status: 'dropped',
    utm_source: 'organic',    utm_medium: null, utm_campaign: null,
    createdMinsAgo: 60 * 24 * 3,
    audit: [
      { actor: 'system',  action: 'lead.created',    minsAgo: 60 * 24 * 3 },
      { actor: 'system',  action: 'otp.sent',         minsAgo: 60 * 24 * 3 - 1 },
      { actor: 'customer',action: 'otp.verified',     minsAgo: 60 * 24 * 3 - 4 },
    ],
    eligibility: {
      status: 'ineligible', score: 589,
      failures: [
        { rule: 'min_cibil_score',  label: 'Minimum CIBIL score', reason: 'CIBIL score 589 is below the minimum of 680' },
        { rule: 'no_ecs_bounces_90d', label: 'No ECS bounces (90 days)', reason: '3 ECS bounce(s) found in the last 90 days' },
        { rule: 'no_overdue',       label: 'No overdue amount', reason: 'Overdue amount of ₹28,500 found' },
        { rule: 'bureau_vintage',   label: 'Bureau vintage > 3 years', reason: 'Bureau vintage is 18 months — minimum 36 months required' },
        { rule: 'nil_lss_sma_dbt',  label: 'Nil LSS / SMA / DBT', reason: 'SMA found in last 36 months' },
      ],
      checkedMinsAgo: 60 * 24 * 3 - 4,
    },
  },

  // 9. Dropped — webhook received
  {
    name: 'Ritu Agarwal',     mobile: fakeMobile(9), status: 'dropped',
    utm_source: 'sms',        utm_medium: 'campaign', utm_campaign: 'reactivation',
    createdMinsAgo: 60 * 24 * 15,
    audit: [
      { actor: 'system',       action: 'lead.created',           minsAgo: 60 * 24 * 15 },
      { actor: 'system',       action: 'otp.sent',                minsAgo: 60 * 24 * 15 - 1 },
      { actor: 'customer',     action: 'otp.verified',            minsAgo: 60 * 24 * 15 - 3 },
      { actor: 'system',       action: 'lead.kft_redirected',     minsAgo: 60 * 24 * 15 - 5 },
      { actor: 'kft_webhook',  action: 'webhook.loan_rejected',   minsAgo: 60 * 24 * 14 },
    ],
    eligibility: {
      status: 'eligible', score: 695,
      failures: [],
      checkedMinsAgo: 60 * 24 * 15 - 3,
    },
    kftSession: {
      utmCode: 'UTM-20260620-SEED004',
      status: 'expired',
      tokenValidTill: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      consentGiven: true,
    },
  },

  // 10. Captured — no name (anonymous entry point)
  {
    name: null,               mobile: fakeMobile(10), status: 'captured',
    utm_source: null,         utm_medium: null, utm_campaign: null,
    createdMinsAgo: 2,
    audit: [
      { actor: 'system', action: 'lead.created', minsAgo: 2 },
    ],
  },

  // 11. Multiple eligibility checks — first failed, second passed
  {
    name: 'Arun Krishnan',    mobile: fakeMobile(11), status: 'kft_redirected',
    utm_source: 'google',     utm_medium: 'cpc', utm_campaign: 'loan_q2',
    createdMinsAgo: 60 * 24 * 5,
    audit: [
      { actor: 'system',  action: 'lead.created',        minsAgo: 60 * 24 * 5 },
      { actor: 'system',  action: 'otp.sent',             minsAgo: 60 * 24 * 5 - 1 },
      { actor: 'customer',action: 'otp.verified',         minsAgo: 60 * 24 * 5 - 3 },
      { actor: 'system',  action: 'lead.kft_redirected',  minsAgo: 60 * 24 * 5 - 6 },
    ],
    // Two eligibility checks — older first (ineligible), latest (eligible)
    eligibilityHistory: [
      {
        status: 'ineligible', score: 671,
        failures: [{ rule: 'min_cibil_score', label: 'Minimum CIBIL score', reason: 'CIBIL score 671 is below the minimum of 680' }],
        checkedMinsAgo: 60 * 24 * 5 - 3,
      },
      {
        status: 'eligible', score: 684,
        failures: [],
        checkedMinsAgo: 60 * 24 * 5 - 5,
      },
    ],
    kftSession: {
      utmCode: 'UTM-20260701-SEED005',
      status: 'redirected',
      tokenValidTill: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000),
      consentGiven: true,
    },
  },
]

// ── Seed ───────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('Clearing existing seed data…')
  await db.query(`DELETE FROM kft_webhook_events WHERE lead_id IN (SELECT id FROM leads WHERE ref_source = 'seed')`)
  await db.query(`DELETE FROM eligibility_checks WHERE lead_id IN (SELECT id FROM leads WHERE ref_source = 'seed')`)
  await db.query(`DELETE FROM kft_sessions WHERE lead_id IN (SELECT id FROM leads WHERE ref_source = 'seed')`)
  await db.query(`DELETE FROM otp_sessions WHERE lead_id IN (SELECT id FROM leads WHERE ref_source = 'seed')`)
  await db.query(`DELETE FROM audit_events WHERE entity_id IN (SELECT id::text FROM leads WHERE ref_source = 'seed')`)
  await db.query(`DELETE FROM leads WHERE ref_source = 'seed'`)
  console.log('  ✓ Cleared\n')

  for (const s of SCENARIOS) {
    await db.transaction(async (client) => {
      const createdAt = ago(s.createdMinsAgo)

      // Insert lead
      const { rows: [lead] } = await client.query(
        `INSERT INTO leads (name, mobile, mobile_hash, ref_source, utm_source, utm_medium, utm_campaign, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'seed', $4, $5, $6, $7, $8, $8)
         RETURNING id`,
        [
          s.name,
          encrypt(s.mobile),
          hash(s.mobile),
          s.utm_source, s.utm_medium, s.utm_campaign,
          s.status,
          createdAt,
        ]
      )
      const leadId = lead.id

      // Audit events
      for (const e of s.audit) {
        await auditEvent(client, {
          entityId: leadId,
          actor: e.actor,
          action: e.action,
          payload: e.payload ?? {},
          createdAt: ago(e.minsAgo),
        })
      }

      // Eligibility checks (single)
      if (s.eligibility) {
        await client.query(
          `INSERT INTO eligibility_checks (lead_id, status, score, failures, bureau_response, checked_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [leadId, s.eligibility.status, s.eligibility.score, JSON.stringify(s.eligibility.failures), '{}', ago(s.eligibility.checkedMinsAgo)]
        )
      }

      // Eligibility history (multiple checks, oldest first)
      if (s.eligibilityHistory) {
        for (const ec of [...s.eligibilityHistory].reverse()) {
          await client.query(
            `INSERT INTO eligibility_checks (lead_id, status, score, failures, bureau_response, checked_at)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [leadId, ec.status, ec.score, JSON.stringify(ec.failures), '{}', ago(ec.checkedMinsAgo)]
          )
        }
      }

      // KFT session
      if (s.kftSession) {
        const ks = s.kftSession
        await client.query(
          `INSERT INTO kft_sessions (lead_id, utm_code, auth_token, refresh_token, token_valid_till, consent_given, consent_at, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            leadId,
            ks.utmCode,
            encrypt('SEED_AUTH_TOKEN_' + ks.utmCode),
            encrypt('SEED_REFRESH_TOKEN_' + ks.utmCode),
            ks.tokenValidTill,
            ks.consentGiven,
            ks.consentGiven ? ago(s.createdMinsAgo - 5) : null,
            ks.status,
            ago(s.createdMinsAgo - 5),
          ]
        )
      }

      console.log(`  ✓ ${s.status.padEnd(16)} ${(s.name ?? '(anonymous)').padEnd(20)} ${s.mobile}`)
    })
  }

  console.log(`\n✓ Seeded ${SCENARIOS.length} leads.\n`)
  console.log('Scenario coverage:')
  console.log('  captured ×2     — fresh lead, anonymous lead')
  console.log('  otp_sent ×1     — OTP sent, not verified')
  console.log('  otp_verified ×2 — one eligible, one ineligible')
  console.log('  kft_redirected ×3 — active token, expired token, multiple eligibility checks')
  console.log('  completed ×1    — disbursed via webhook')
  console.log('  dropped ×2      — ineligible rejection, KFT rejected via webhook')
}

seed()
  .then(() => db.pool.end())
  .catch(err => { console.error(err); db.pool.end(); process.exit(1) })
