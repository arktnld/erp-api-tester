import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({ role: 'admin', ops: [] as string[] }))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/audit', () => ({ recordAudit: async () => {} }))
vi.mock('@/lib/session', () => ({ getSessionUser: async () => ({ id: 1, email: 'a@x', name: 'A', role: state.role }) }))
vi.mock('@erp/db', () => {
  const op = (name: string) => () => { state.ops.push(name); return {} }
  return {
    prisma: {
      eRP: { findUniqueOrThrow: async () => ({ name: 'HTTPBin', _count: { endpoints: 12, fieldSchemas: 0 } }), delete: op('eRP.delete') },
      company: {
        findMany: async () => [{ name: 'HTTPBin.org', _count: { testClients: 1, apiRecords: 0 } }],
        deleteMany: op('company.deleteMany'),
      },
      playbook: { findMany: async () => [{ name: 'Fluxo' }], deleteMany: op('playbook.deleteMany') },
      apiRecord: { deleteMany: op('apiRecord.deleteMany') },
      playbookRun: { deleteMany: op('playbookRun.deleteMany'), count: async () => 3 },
      $transaction: async (ops: unknown[]) => ops,
    },
  }
})

import { deleteERP, getERPDeletionImpact } from './erps'

beforeEach(() => { state.role = 'admin'; state.ops = [] })

describe('deleting an ERP', () => {
  it('lists companies, playbooks and what goes with them', async () => {
    expect(await getERPDeletionImpact(6)).toEqual({
      name: 'HTTPBin', endpoints: 12, fieldSchemas: 0,
      companies: [{ name: 'HTTPBin.org', testClients: 1, records: 0 }],
      playbooks: ['Fluxo'],
      playbookRuns: 3,
    })
  })

  it('removes what blocks the ERP first, then the ERP, in one transaction', async () => {
    await deleteERP(6)
    expect(state.ops).toEqual(['apiRecord.deleteMany', 'playbookRun.deleteMany', 'playbook.deleteMany', 'company.deleteMany', 'eRP.delete'])
  })

  it('is admin-only', async () => {
    state.role = 'editor'
    await expect(getERPDeletionImpact(6)).rejects.toThrow('Permissão insuficiente')
    await expect(deleteERP(6)).rejects.toThrow('Permissão insuficiente')
    expect(state.ops).toEqual([])
  })
})
