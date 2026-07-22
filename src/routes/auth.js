import { z } from 'zod'
import { otpService } from '../modules/auth/otpService.js'
import { leadsService } from '../modules/leads/leadsService.js'

export const authRoutes = async (fastify) => {
  // Customer OTP flow
  fastify.post('/v1/auth/otp/send', async (request, reply) => {
    const { lead_id, mobile } = z.object({
      lead_id: z.string().uuid(),
      mobile: z.string().regex(/^[6-9]\d{9}$/),
    }).parse(request.body)

    const lead = await leadsService.findById(lead_id)
    if (!lead) return reply.code(404).send({ error: 'Lead not found' })

    const result = await otpService.sendOtp({ mobile, leadId: lead_id })
    return reply.send({ data: result })
  })

  fastify.post('/v1/auth/otp/verify', async (request, reply) => {
    const { lead_id, mobile, code } = z.object({
      lead_id: z.string().uuid(),
      mobile: z.string().regex(/^[6-9]\d{9}$/),
      code: z.string().length(6),
    }).parse(request.body)

    const result = await otpService.verifyOtp({ mobile, code, leadId: lead_id })
    if (!result.success) {
      const OTP_MESSAGES = {
        otp_not_found:     'No active OTP found for this number. Please request a new OTP.',
        otp_expired:       'Your OTP has expired. Please request a new OTP.',
        too_many_attempts: 'Too many incorrect attempts. Please wait a moment and request a new OTP.',
        invalid_code:      'Incorrect OTP. Please double-check the code and try again.',
      }
      return reply.code(400).send({ error: OTP_MESSAGES[result.reason] ?? result.reason })
    }
    return reply.send({ data: { verified: true } })
  })

  // Admin login
  fastify.post('/v1/auth/admin/login', async (request, reply) => {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string().min(8),
    }).parse(request.body)

    const result = await otpService.adminLogin({ email, password, fastify })
    if (!result) return reply.code(401).send({ error: 'Invalid credentials' })
    return reply.send({ data: result })
  })
}
