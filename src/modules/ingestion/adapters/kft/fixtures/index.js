// Deterministic sandbox responses — returned when NODE_ENV=test or SANDBOX=true
export const fixtures = {
  generateUTM: {
    Data: { UTM: 'https://mf-embed-uat.knightfintech.com/?utm_code=UTM-SANDBOX-fixture-001' },
    Meta: { Success: true, StatusCode: '200', Message: 'UTM link generated successfully.' },
  },

  generateToken: {
    Data: {
      Token: 'SANDBOX_TOKEN_fixture_001',
      TokenValidTill: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      RefreshToken: 'SANDBOX_REFRESH_TOKEN_fixture_001',
      PartnerId: null,
      Message: 'Audience secret code verified successfully.',
    },
    Meta: { Success: true, StatusCode: '200', Message: 'Audience secret code verified successfully.' },
  },

  recordConsent: {
    Data: {},
    Meta: { Success: true, StatusCode: '200', Message: 'Consent successfully captured.' },
  },
}
