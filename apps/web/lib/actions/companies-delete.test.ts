import { describe, it, expect, vi, beforeEach } from 'vitest'

const state = vi.hoisted(() => ({ role: 'editor', ops: [] as string[] }))

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/audit', () => ({ recordAudit: async () => {} }))
vi.mock('@/lib/session', () => ({ getSessionUser: async () => ({ id: 1, email: 'e@x', name: 'E', role: state.role }) }))
vi.mock('@erp/db', () => {
  const op = (name: string, result: unknown = {}) => (args?: unknown) => { state.ops.push(name); void args; return result }
  return {
    prisma: {
      company: { findUniqueOrThrow: async () => ({ name: 'Co' }), delete: op('company.delete') },
      apiRecord: {
        deleteMany: op('apiRecord.deleteMany'),
        findMany: async () => [{ name: 'Rec A', _count: { blocks: 3 } }],
      },
      playbookRun: { deleteMany: op('playbookRun.deleteMany'), count: async () => 4 },
      testClient: { findMany: async () => [{ name: 'Cliente 1' }] },
      requestHistory: { count: async () => 12 },
      $transaction: async (ops: unknown[]) => ops,
    },
  }
})

import { deleteCompany, getCompanyDeletionImpact } from './companies'

beforeEach(() => { state.role = 'editor'; state.ops = [] })

describe('deleting a company', () => {
  it('shows everything that goes with it first', async () => {
    expect(await getCompanyDeletionImpact(7)).toEqual({
      name: 'Co', testClients: ['Cliente 1'], records: [{ name: 'Rec A', blocks: 3 }], playbookRuns: 4, history: 12,
    })
  })

  it('removes records and playbook runs before the company, in one transaction', async () => {
    await deleteCompany(7)
    expect(state.ops).toEqual(['apiRecord.deleteMany', 'playbookRun.deleteMany', 'company.delete'])
  })

  it('is not allowed for viewers', async () => {
    state.role = 'viewer'
    await expect(getCompanyDeletionImpact(7)).rejects.toThrow('Permissão insuficiente')
    await expect(deleteCompany(7)).rejects.toThrow('Permissão insuficiente')
    expect(state.ops).toEqual([])
  })
})
