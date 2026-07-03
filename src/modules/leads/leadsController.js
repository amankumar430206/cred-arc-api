import { z } from 'zod'
import { leadsService } from './leadsService.js'

const createLeadSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number'),
  ref_source: z.string().optional(),
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
})

export const leadsController = {
  create: async (request, reply) => {
    const body = createLeadSchema.parse(request.body)
    const lead = await leadsService.createLead({
      name: body.name,
      mobile: body.mobile,
      refSource: body.ref_source,
      utmSource: body.utm_source,
      utmMedium: body.utm_medium,
      utmCampaign: body.utm_campaign,
    })
    return reply.code(201).send({ data: lead })
  },

  getById: async (request, reply) => {
    const lead = await leadsService.findById(request.params.id)
    if (!lead) return reply.code(404).send({ error: 'Lead not found' })
    return reply.send({ data: lead })
  },
}
