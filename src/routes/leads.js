import { z } from 'zod'
import { leadsController } from '../modules/leads/leadsController.js'
import { embedService } from '../modules/lifecycle/embedService.js'
import { leadsService } from '../modules/leads/leadsService.js'

export const leadsRoutes = async (fastify) => {
  // Create lead (called from onboarding page on load)
  fastify.post('/v1/leads', leadsController.create)

  // Initiate KFT embed flow — returns journey URL
  fastify.post('/v1/loans/embed/initiate', async (request, reply) => {
    const { lead_id } = z.object({ lead_id: z.string().uuid() }).parse(request.body)

    const lead = await leadsService.findById(lead_id)
    if (!lead) return reply.code(404).send({ error: 'Lead not found' })
    if (lead.status !== 'otp_verified') {
      return reply.code(400).send({ error: 'OTP must be verified before initiating loan journey' })
    }

    const result = await embedService.initiate({
      lead,
      utmSource: lead.utm_source,
      utmMedium: lead.utm_medium,
      utmCampaign: lead.utm_campaign,
    })

    return reply.send({ data: result })
  })

  // Poll KFT session status
  fastify.get('/v1/loans/embed/:leadId/session', async (request, reply) => {
    const session = await embedService.getSession(request.params.leadId)
    if (!session) return reply.code(404).send({ error: 'No KFT session found' })
    return reply.send({ data: session })
  })
}
