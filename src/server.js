import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'

import { authRoutes } from './routes/auth.js'
import { leadsRoutes } from './routes/leads.js'
import { adminLeadsRoutes } from './routes/admin/leads.js'
import { adminClientsRoutes } from './routes/admin/clients.js'

const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } })

// Plugins
await fastify.register(cors, {
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'],
  credentials: true,
})

await fastify.register(jwt, { secret: process.env.JWT_SECRET })

await fastify.register(rateLimit, { max: 60, timeWindow: '1 minute' })

// Health
fastify.get('/health', async () => ({ status: 'ok', ts: new Date().toISOString() }))

// Routes
await fastify.register(authRoutes)
await fastify.register(leadsRoutes)
await fastify.register(adminLeadsRoutes)
await fastify.register(adminClientsRoutes)

// Global error handler
fastify.setErrorHandler((err, request, reply) => {
  if (err.name === 'ZodError') {
    return reply.code(400).send({ error: 'Validation error', details: err.errors })
  }
  fastify.log.error(err)
  reply.code(err.status ?? 500).send({ error: err.message ?? 'Internal server error' })
})

const start = async () => {
  try {
    await fastify.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
