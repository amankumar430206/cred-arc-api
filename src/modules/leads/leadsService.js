import { db } from '../../db/index.js'
import { leadsRepo } from './leadsRepo.js'
import { appendAuditEvent } from '../compliance/auditLog.js'
import { hashPII } from '../../shared/crypto.js'

export const leadsService = {
  createLead: async ({ name, mobile, refSource, utmSource, utmMedium, utmCampaign, orgId }) => {
    return db.transaction(async (client) => {
      const lead = await leadsRepo.create(client, { name, mobile, refSource, utmSource, utmMedium, utmCampaign, orgId })
      await appendAuditEvent(client, {
        orgId,
        actor: 'system',
        entityType: 'lead',
        entityId: lead.id,
        action: 'lead.created',
        payload: { refSource, utmSource, utmMedium, utmCampaign },
      })
      return lead
    })
  },

  advanceStatus: async (leadId, status, actor = 'system', meta = {}) => {
    return db.transaction(async (client) => {
      const lead = await leadsRepo.updateStatus(client, leadId, status)
      await appendAuditEvent(client, {
        actor,
        entityType: 'lead',
        entityId: leadId,
        action: `lead.${status}`,
        payload: meta,
      })
      return lead
    })
  },

  findByMobile: (mobile) => leadsRepo.findByMobileHash(hashPII(mobile)),
  findById: (id) => leadsRepo.findById(id),
  list: (filters) => leadsRepo.list(filters),
}
