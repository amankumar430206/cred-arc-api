import 'dotenv/config'
import { createHash } from 'crypto'
import { db } from '../src/db/index.js'

const email = process.env.ADMIN_EMAIL ?? 'admin@credarc.in'
const password = process.env.ADMIN_PASSWORD ?? 'Admin@1234'
const role = 'super_admin'

const hash = createHash('sha256').update(password).digest('hex')

const { rows } = await db.query(
  `INSERT INTO admin_users (email, password_hash, role)
   VALUES ($1, $2, $3)
   ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
   RETURNING id, email, role`,
  [email, hash, role]
)

console.log('Admin user upserted:', rows[0])
await db.pool.end()
process.exit(0)
