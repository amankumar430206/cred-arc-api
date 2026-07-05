import 'dotenv/config'
import { db } from '../src/db/index.js'
import { up } from '../src/db/migrations/001_initial_schema.js'

console.log('Running migration 001_initial_schema…')
try {
  await up(db)
  console.log('Migration complete.')
} catch (err) {
  if (err.message?.includes('already exists')) {
    console.log('Tables already exist — skipping.')
  } else {
    console.error('Migration failed:', err.message)
    process.exit(1)
  }
}
await db.pool.end()
process.exit(0)
