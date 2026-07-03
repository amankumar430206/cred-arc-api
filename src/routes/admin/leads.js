import { z } from 'zod'
import { leadsService } from '../../modules/leads/leadsService.js'
import { getAuditTrail } from '../../modules/compliance/auditLog.js'
import { adminAuth } from '../../middleware/adminAuth.js'

export const adminLeadsRoutes = async (fastify) => {
  fastify.addHook('preHandler', adminAuth)

  fastify.get('/v1/admin/leads', async (request, reply) => {
    const { limit = 20, offset = 0, status, search } = z.object({
      limit: z.coerce.number().max(100).default(20),
      offset: z.coerce.number().default(0),
      status: z.string().optional(),
      search: z.string().optional(),
    }).parse(request.query)

    const result = await leadsService.list({ limit, offset, status, search })
    return reply.send(result)
  })

  fastify.get('/v1/admin/leads/:id', async (request, reply) => {
    const lead = await leadsService.findById(request.params.id)
    if (!lead) return reply.code(404).send({ error: 'Lead not found' })
    const audit = await getAuditTrail('lead', request.params.id)
    return reply.send({ data: { ...lead, audit } })
  })
}
