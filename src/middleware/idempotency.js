import { db } from '../db/index.js'

// POST endpoints that mutate state accept an Idempotency-Key header.
// If the key was seen before, return the cached response.
export const idempotency = async (request, reply) => {
  const key = request.headers['idempotency-key']
  if (!key) return

  const { rows } = await db.query(
    `SELECT response_body, status_code FROM idempotency_keys WHERE key = $1`,
    [key]
  ).catch(() => ({ rows: [] }))

  if (rows[0]) {
    return reply
      .code(rows[0].status_code)
      .header('X-Idempotent-Replayed', 'true')
      .send(rows[0].response_body)
  }

  // Store key + response after handler runs via onSend hook
  reply.idempotencyKey = key
}
