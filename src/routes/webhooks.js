import crypto from 'crypto'
import { webhookService } from '../modules/lifecycle/webhookService.js'

const WEBHOOK_SECRET = process.env.KFT_WEBHOOK_SECRET

function verifySignature(rawBody, signatureHeader) {
  if (!WEBHOOK_SECRET) return true
  if (!signatureHeader) return false
  const expected = 'sha256=' + crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader))
}

export const webhookRoutes = async (fastify) => {
  fastify.post('/v1/webhooks/kft', {
    config: { rawBody: true },
    // Override content-type parsing for this route only via preParsing hook
    preParsing: async (request, reply, payload) => {
      const chunks = []
      for await (const chunk of payload) chunks.push(chunk)
      const rawBody = Buffer.concat(chunks)
      request.rawBody = rawBody
      // Return a readable stream of the same bytes for Fastify's normal JSON parser
      const { Readable } = await import('stream')
      return Readable.from(rawBody)
    },
  }, async (request, reply) => {
    const rawBody = request.rawBody
    const signature = request.headers['x-kft-signature']

    if (!verifySignature(rawBody, signature)) {
      return reply.code(401).send({ error: 'Invalid webhook signature' })
    }

    let payload
    try {
      payload = JSON.parse(rawBody.toString())
    } catch {
      return reply.code(400).send({ error: 'Invalid JSON body' })
    }

    try {
      const result = await webhookService.process(payload)
      return reply.code(200).send({ ok: true, ...result })
    } catch (err) {
      request.log.error({ err, payload }, 'KFT webhook processing failed')
      return reply.code(500).send({ error: 'Webhook processing failed' })
    }
  })
}
