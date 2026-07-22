import { z } from 'zod'
import { b2bService } from '../modules/b2b/b2bService.js'

const FileSchema = z.object({
  name: z.string(),
  size: z.number(),
  type: z.string(),
  data: z.string(), // base64
}).nullable().optional()

const ApplicationSchema = z.object({
  // Company
  company_name:          z.string().min(1).max(200),
  industry:              z.string().min(1),
  incorporation_date:    z.string().regex(/^\d{2}\/\d{2}$/, 'Format: MM/YY'),
  gst_number:            z.string().max(15).optional(),

  // Director
  director_name:         z.string().min(1).max(200),
  mobile:                z.string().regex(/^[6-9]\d{9}$/),
  email:                 z.string().email(),
  id_number:             z.string().min(8).max(16).optional(),
  id_type:               z.enum(['aadhaar', 'pan']).optional(),

  // Business metrics
  client_count:          z.coerce.number().int().positive().optional(),
  invoices_per_month:    z.coerce.number().int().positive().optional(),
  avg_billing_cycle_days: z.coerce.number().int().positive().optional(),
  avg_bill_value:        z.coerce.number().positive().optional(),
  annual_turnover:       z.coerce.number().positive().optional(),

  // Financing
  required_amount:       z.coerce.number().positive().optional(),
  financing_type:        z.string().optional(),

  // Documents (base64 payload from frontend)
  incorporation_cert:    FileSchema,
  company_deck:          FileSchema,
})

export const b2bRoutes = async (fastify) => {
  fastify.post('/v1/apply', {
    config: { bodyLimit: 25 * 1024 * 1024 }, // 25 MB — allow file payloads
  }, async (request, reply) => {
    const body = ApplicationSchema.parse(request.body)
    const lead = await b2bService.create(body)
    return reply.code(201).send({ data: lead })
  })
}
