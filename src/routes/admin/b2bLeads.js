import { z } from 'zod'
import { b2bService } from '../../modules/b2b/b2bService.js'
import { adminAuth } from '../../middleware/adminAuth.js'

export const adminB2BLeadsRoutes = async (fastify) => {
  fastify.addHook('preHandler', adminAuth)

  fastify.get('/v1/admin/b2b-leads', async (request, reply) => {
    const { search, status, financing_type, limit, offset } = request.query
    const result = await b2bService.list({
      search,
      status,
      financing_type,
      limit: limit ? parseInt(limit) : 20,
      offset: offset ? parseInt(offset) : 0,
    })
    return reply.send({
      data: result.data,
      pagination: { total: result.total, limit: limit ? parseInt(limit) : 20, offset: offset ? parseInt(offset) : 0 },
    })
  })

  fastify.get('/v1/admin/b2b-leads/:id', async (request, reply) => {
    const lead = await b2bService.getById(request.params.id)
    if (!lead) return reply.code(404).send({ error: 'Lead not found' })

    // Strip base64 data from document fields to keep response lean; return metadata only
    // unless the ?include_docs=1 param is passed
    if (!request.query.include_docs) {
      if (lead.incorporation_cert) lead.incorporation_cert = { name: lead.incorporation_cert.name, size: lead.incorporation_cert.size, type: lead.incorporation_cert.type }
      if (lead.company_deck) lead.company_deck = { name: lead.company_deck.name, size: lead.company_deck.size, type: lead.company_deck.type }
    }

    return reply.send({ data: lead })
  })

  fastify.patch('/v1/admin/b2b-leads/:id/status', async (request, reply) => {
    const body = z.object({
      status: z.enum(['new', 'reviewing', 'approved', 'rejected', 'on_hold']),
      admin_notes: z.string().max(2000).nullish().transform(v => v ?? undefined),
    }).parse(request.body)

    const updated = await b2bService.updateStatus(request.params.id, body)
    if (!updated) return reply.code(404).send({ error: 'Lead not found' })
    return reply.send({ data: updated })
  })

  // Presigned doc download — returns the base64 data for a specific document
  fastify.get('/v1/admin/b2b-leads/:id/document/:doc', async (request, reply) => {
    const { id, doc } = request.params
    if (!['incorporation_cert', 'company_deck'].includes(doc)) {
      return reply.code(400).send({ error: 'Invalid document field' })
    }

    const lead = await b2bService.getById(id)
    if (!lead) return reply.code(404).send({ error: 'Lead not found' })
    if (!lead[doc]) return reply.code(404).send({ error: 'Document not found' })

    return reply.send({ data: lead[doc] })
  })
}
