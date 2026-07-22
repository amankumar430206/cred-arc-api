import 'dotenv/config'

const BASE_URL = process.env.KFT_BASE_URL
const AUDIENCE_SECRET = process.env.KFT_AUDIENCE_SECRET_CODE
const PARTNER_CODE = process.env.KFT_PARTNER_CODE

const kftFetch = async (path, { method = 'POST', body, token, partnerCustomerId, version = '' } = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'K-Aurix-Version': version,
  }

  if (token) headers['K-Aurix-Token'] = token
  if (!token && AUDIENCE_SECRET) headers['K-Aurix-AudienceSecretCode'] = AUDIENCE_SECRET
  if (partnerCustomerId) headers['K-Aurix-PartnerCustomerId'] = partnerCustomerId

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = await res.json()

  if (!res.ok || json?.Meta?.Success === false) {
    const msg = json?.Meta?.Message ?? `KFT error ${res.status}`
    const err = new Error(msg)
    err.status = res.status
    err.kftResponse = json
    throw err
  }

  return json
}

export { kftFetch, PARTNER_CODE }
