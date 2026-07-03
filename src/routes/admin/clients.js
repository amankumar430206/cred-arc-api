import { z } from 'zod'
import { db } from '../../db/index.js'
import { adminAuth } from '../../middleware/adminAuth.js'

export const adminClientsRoutes = async (fastify) => {
  fastify.addHook('preHandler', adminAuth)

  fastify.get('/v1/admin/clients', async (request, reply) => {
    const { rows } = await db.query(
      `SELECT id, name, type, whitelabel_config, created_at FROM orgs ORDER BY created_at DESC`
    )
    return reply.send({ data: rows })
  })

  fastify.post('/v1/admin/clients', async (request, reply) => {
    const body = z.object({
      name: z.string().min(1).max(100),
      type: z.enum(['lender', 'platform']).default('lender'),
      whitelabel_config: z.record(z.unknown()).default({}),
    }).parse(request.body)

    const { rows } = await db.query(
      `INSERT INTO orgs (name, type, whitelabel_config) VALUES ($1, $2, $3) RETURNING *`,
      [body.name, body.type, JSON.stringify(body.whitelabel_config)]
    )
    return reply.code(201).send({ data: rows[0] })
  })

  fastify.patch('/v1/admin/clients/:id', async (request, reply) => {
    const body = z.object({
      name: z.string().min(1).max(100).optional(),
      whitelabel_config: z.record(z.unknown()).optional(),
    }).parse(request.body)

    const sets = []
    const params = []
    if (body.name) { params.push(body.name); sets.push(`name = $${params.length}`) }
    if (body.whitelabel_config) { params.push(JSON.stringify(body.whitelabel_config)); sets.push(`whitelabel_config = $${params.length}`) }
    if (!sets.length) return reply.code(400).send({ error: 'Nothing to update' })

    params.push(request.params.id)
    const { rows } = await db.query(
      `UPDATE orgs SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params
    )
    if (!rows[0]) return reply.code(404).send({ error: 'Client not found' })
    return reply.send({ data: rows[0] })
  })

  fastify.get('/v1/admin/kft-sessions', async (request, reply) => {
    const { rows } = await db.query(
      `SELECT k.id, k.lead_id, k.utm_code, k.token_valid_till, k.consent_given, k.status, k.created_at,
              l.name as lead_name, l.status as lead_status
       FROM kft_sessions k
       JOIN leads l ON l.id = k.lead_id
       ORDER BY k.created_at DESC
       LIMIT 100`
    )
    return reply.send({ data: rows })
  })
}
