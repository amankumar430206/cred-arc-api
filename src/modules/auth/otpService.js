import { createHash, randomInt } from 'crypto'
import { db } from '../../db/index.js'
import { hashPII } from '../../shared/crypto.js'
import { leadsService } from '../leads/leadsService.js'

const OTP_TTL_MINUTES = 10
const MAX_ATTEMPTS = 5

const hashCode = (code) => createHash('sha256').update(String(code)).digest('hex')

const generateCode = () => String(randomInt(100000, 999999))

// Dev-only in-memory OTP log (last 50 entries, cleared on restart)
export const devOtpLog = []
const DEV_LOG_MAX = 50

export const otpService = {
  sendOtp: async ({ mobile, leadId }) => {
    const code = generateCode()
    const mobileHash = hashPII(mobile)
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000)

    // Invalidate any existing unexpired OTPs for this mobile
    await db.query(
      `UPDATE otp_sessions SET verified = TRUE WHERE mobile_hash = $1 AND verified = FALSE`,
      [mobileHash]
    )

    await db.query(
      `INSERT INTO otp_sessions (lead_id, mobile_hash, code_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [leadId, mobileHash, hashCode(code), expiresAt]
    )

    await leadsService.advanceStatus(leadId, 'otp_sent', 'system')

    // TODO: integrate SMS provider (Twilio/MSG91) for production.
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[OTP DEV] mobile=${mobile} code=${code}`)
      devOtpLog.unshift({ mobile, code, leadId, expiresAt, createdAt: new Date().toISOString() })
      if (devOtpLog.length > DEV_LOG_MAX) devOtpLog.length = DEV_LOG_MAX
      return { sent: true, expiresAt, dev_otp: code }
    }

    return { sent: true, expiresAt }
  },

  verifyOtp: async ({ mobile, code, leadId }) => {
    const mobileHash = hashPII(mobile)

    const { rows } = await db.query(
      `SELECT id, code_hash, expires_at, attempts
       FROM otp_sessions
       WHERE mobile_hash = $1 AND lead_id = $2 AND verified = FALSE
       ORDER BY created_at DESC LIMIT 1`,
      [mobileHash, leadId]
    )

    const session = rows[0]
    if (!session) return { success: false, reason: 'otp_not_found' }
    if (new Date(session.expires_at) < new Date()) return { success: false, reason: 'otp_expired' }
    if (session.attempts >= MAX_ATTEMPTS) return { success: false, reason: 'too_many_attempts' }

    await db.query(
      `UPDATE otp_sessions SET attempts = attempts + 1 WHERE id = $1`,
      [session.id]
    )

    if (session.code_hash !== hashCode(code)) return { success: false, reason: 'invalid_code' }

    await db.query(`UPDATE otp_sessions SET verified = TRUE WHERE id = $1`, [session.id])
    await leadsService.advanceStatus(leadId, 'otp_verified', 'customer')

    return { success: true }
  },

  // Admin login — email + password; returns JWT via fastify.jwt
  adminLogin: async ({ email, password, fastify }) => {
    const { createHash } = await import('crypto')
    const { rows } = await db.query(
      `SELECT id, email, role, password_hash FROM admin_users WHERE email = $1`,
      [email.toLowerCase()]
    )
    const user = rows[0]
    if (!user) return null

    const ph = createHash('sha256').update(password).digest('hex')
    if (ph !== user.password_hash) return null

    await db.query(`UPDATE admin_users SET last_login_at = NOW() WHERE id = $1`, [user.id])

    const token = fastify.jwt.sign({ id: user.id, email: user.email, role: user.role })
    return { token, user: { id: user.id, email: user.email, role: user.role } }
  },
}
