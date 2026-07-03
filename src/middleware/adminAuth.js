import { db } from '../db/index.js'

// Validates the JWT issued at admin login; attaches adminUser to request.
export const adminAuth = async (request, reply) => {
  try {
    await request.jwtVerify()
    const { rows } = await db.query(
      'SELECT id, email, role FROM admin_users WHERE id = $1',
      [request.user.id]
    )
    if (!rows[0]) return reply.code(401).send({ error: 'Unauthorized' })
    request.adminUser = rows[0]
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' })
  }
}
