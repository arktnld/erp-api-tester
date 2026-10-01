import { prisma } from '@erp/db'
import { getSessionUser } from '@/lib/session'

export type AuditAction = 'create' | 'update' | 'delete' | 'execute'
export type AuditResource = 'erp' | 'company' | 'endpoint' | 'playbook' | 'testClient'

export async function recordAudit(
  action: AuditAction,
  resourceType: AuditResource,
  resourceId: string | number,
  resourceName: string
) {
  try {
    const user = await getSessionUser()
    if (!user) return
    await prisma.auditLog.create({
      data: {
        userId: String(user.id),
        userEmail: user.email,
        action,
        resourceType,
        resourceId: String(resourceId),
        resourceName,
      },
    })
  } catch {
    // Audit failures must not break the main operation
  }
}
