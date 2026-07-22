import { db } from '../../db/index.js'

const LIST_COLS = `
  id, company_name, industry, incorporation_date, gst_number,
  director_name, mobile, email, id_type,
  client_count, invoices_per_month, avg_billing_cycle_days, avg_bill_value, annual_turnover,
  required_amount, financing_type,
  incorporation_cert->>'name' AS incorporation_cert_name,
  company_deck->>'name' AS company_deck_name,
  status, admin_notes, created_at, updated_at
`

export const b2bService = {
  async create(data) {
    const {
      company_name, industry, incorporation_date, gst_number,
      director_name, mobile, email, id_number, id_type,
      client_count, invoices_per_month, avg_billing_cycle_days, avg_bill_value, annual_turnover,
      required_amount, financing_type,
      incorporation_cert, company_deck,
    } = data

    const { rows } = await db.query(
      `INSERT INTO b2b_leads (
        company_name, industry, incorporation_date, gst_number,
        director_name, mobile, email, id_number, id_type,
        client_count, invoices_per_month, avg_billing_cycle_days, avg_bill_value, annual_turnover,
        required_amount, financing_type, incorporation_cert, company_deck
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      RETURNING id, company_name, director_name, mobile, email, status, created_at`,
      [
        company_name, industry, incorporation_date, gst_number ?? null,
        director_name, mobile, email, id_number ?? null, id_type ?? null,
        client_count ?? null, invoices_per_month ?? null, avg_billing_cycle_days ?? null,
        avg_bill_value ?? null, annual_turnover ?? null,
        required_amount ?? null, financing_type ?? null,
        incorporation_cert ? JSON.stringify(incorporation_cert) : null,
        company_deck ? JSON.stringify(company_deck) : null,
      ]
    )
    return rows[0]
  },

  async list({ search, status, financing_type, limit = 20, offset = 0 } = {}) {
    const conditions = []
    const params = []

    if (search) {
      params.push(`%${search}%`)
      conditions.push(`(company_name ILIKE $${params.length} OR director_name ILIKE $${params.length} OR mobile ILIKE $${params.length} OR email ILIKE $${params.length})`)
    }
    if (status) {
      params.push(status)
      conditions.push(`status = $${params.length}`)
    }
    if (financing_type) {
      params.push(financing_type)
      conditions.push(`financing_type = $${params.length}`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    params.push(limit, offset)
    const { rows } = await db.query(
      `SELECT ${LIST_COLS} FROM b2b_leads ${where}
       ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    )

    const countParams = params.slice(0, -2)
    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) FROM b2b_leads ${where}`,
      countParams
    )

    return { data: rows, total: parseInt(countRows[0].count) }
  },

  async getById(id) {
    const { rows } = await db.query(
      `SELECT
        id, company_name, industry, incorporation_date, gst_number,
        director_name, mobile, email, id_number, id_type,
        client_count, invoices_per_month, avg_billing_cycle_days, avg_bill_value, annual_turnover,
        required_amount, financing_type,
        incorporation_cert, company_deck,
        status, admin_notes, created_at, updated_at
       FROM b2b_leads WHERE id = $1`,
      [id]
    )
    return rows[0] ?? null
  },

  async updateStatus(id, { status, admin_notes }) {
    const sets = ['status = $1', 'updated_at = NOW()']
    const params = [status, id]
    if (admin_notes !== undefined) {
      sets.push(`admin_notes = $${params.length}`)
      params.splice(params.length - 1, 0, admin_notes)
    }
    const { rows } = await db.query(
      `UPDATE b2b_leads SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id, status, admin_notes, updated_at`,
      params
    )
    return rows[0] ?? null
  },
}
