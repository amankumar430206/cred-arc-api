import { db } from '../../db/index.js'
import { encrypt, decrypt, hashPII } from '../../shared/crypto.js'

export const leadsRepo = {
  create: async (client, { name, mobile, refSource, utmSource, utmMedium, utmCampaign, orgId }) => {
    const { rows } = await client.query(
      `INSERT INTO leads (org_id, name, mobile, mobile_hash, ref_source, utm_source, utm_medium, utm_campaign)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, status, created_at`,
      [orgId ?? null, name ?? null, encrypt(mobile), hashPII(mobile), refSource ?? 'myntpe', utmSource ?? null, utmMedium ?? null, utmCampaign ?? null]
    )
    return rows[0]
  },

  updateStatus: async (client, id, status) => {
    const { rows } = await client.query(
      `UPDATE leads SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status`,
      [status, id]
    )
    return rows[0]
  },

  findByMobileHash: async (mobileHash) => {
    const { rows } = await db.query(
      `SELECT id, name, mobile, mobile_hash, status, ref_source, utm_source, utm_medium, utm_campaign, created_at, updated_at
       FROM leads WHERE mobile_hash = $1 ORDER BY created_at DESC LIMIT 1`,
      [mobileHash]
    )
    if (!rows[0]) return null
    return { ...rows[0], mobile: decrypt(rows[0].mobile) }
  },

  findById: async (id) => {
    const { rows } = await db.query(
      `SELECT l.*, k.utm_code, k.status as kft_status, k.token_valid_till, k.consent_given, k.consent_at
       FROM leads l
       LEFT JOIN kft_sessions k ON k.lead_id = l.id
       WHERE l.id = $1`,
      [id]
    )
    if (!rows[0]) return null
    return { ...rows[0], mobile: decrypt(rows[0].mobile) }
  },

  // Admin list — never decrypts mobile in bulk; returns masked version
  list: async ({ limit = 20, offset = 0, status, search }) => {
    const conditions = ['1=1']
    const params = []

    if (status) { params.push(status); conditions.push(`l.status = $${params.length}`) }
    if (search) { params.push(`%${search}%`); conditions.push(`l.name ILIKE $${params.length}`) }

    params.push(limit, offset)
    const { rows } = await db.query(
      `SELECT l.id, l.name,
              CONCAT(SUBSTRING(l.mobile_hash, 1, 4), '***') as mobile_masked,
              l.status, l.ref_source, l.utm_source, l.created_at, l.updated_at
       FROM leads l
       WHERE ${conditions.join(' AND ')}
       ORDER BY l.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) FROM leads l WHERE ${conditions.slice(0, -2).join(' AND ')}`,
      params.slice(0, -2)
    )
    return { data: rows, total: parseInt(countRows[0]?.count ?? 0) }
  },
}
