import { kftFetch, PARTNER_CODE } from './client.js'
import { fixtures } from './fixtures/index.js'

const isSandbox = () => process.env.NODE_ENV === 'test' || process.env.KFT_SANDBOX === 'true'

export const kftAdapter = {
  generateUTM: async ({ mobile, utmSource, utmMedium, utmCampaign }) => {
    if (isSandbox()) return fixtures.generateUTM

    const res = await kftFetch('/api/utm_generation', {
      body: {
        UTMSource: utmSource ?? process.env.KFT_UTM_SOURCE ?? 'CREDARC',
        UTMMedium: utmMedium ?? 'app',
        UTMCampaign: utmCampaign ?? 'general',
        MobileNumber: mobile,
      },
    })

    return res
  },

  generateToken: async ({ partnerCustomerId }) => {
    if (isSandbox()) return fixtures.generateToken

    const res = await kftFetch('/api/generate_token', {
      version: 'v3',
      body: { PartnerCustomerID: partnerCustomerId },
    })

    return res
  },

  recordConsent: async ({ mobile, token, isPaPq = false, lenderId }) => {
    if (isSandbox()) return fixtures.recordConsent

    const query = isPaPq && lenderId ? `?is_pa_pq=true&lender_id=${lenderId}` : ''

    const res = await kftFetch(`/api/consent${query}`, {
      token,
      body: {
        MobileNumber: mobile,
        IsConsentGiven: true,
        PartnerCode: PARTNER_CODE,
        ConsentTimestamp: new Date().toISOString(),
      },
    })

    return res
  },

  healthCheck: async () => {
    if (isSandbox()) return { ok: true, sandbox: true }
    try {
      await kftFetch('/api/health', { method: 'GET' })
      return { ok: true }
    } catch {
      return { ok: false }
    }
  },
}
