import { describe, it, expect, vi, beforeEach } from 'vitest'

// Role guards on server actions. The session and Prisma are mocked; the actions are the real ones.
const authState = vi.hoisted(() => ({ role: 'viewer' as string }))

vi.mock('@/lib/session', () => ({
  getSessionUser: async () => ({ id: 1, email: 'u@example.com', name: 'U', role: authState.role }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

const company = { id: 1, name: 'C', authType: 'bearer', authConfig: { token: 'secret-token' } }
const db = vi.hoisted(() => ({
  company: {
    findMany: vi.fn(async () => [company]),
    findUniqueOrThrow: vi.fn(async () => company),
  },
  apiRecord: {
    findUnique: vi.fn(async () => ({ id: 1, company, blocks: [{ id: 1, response: { requestHeaders: { Authorization: 'Bearer secret-token' } } }] })),
  },
  playbookRun: {
    findUniqueOrThrow: vi.fn(async () => ({ id: 1, steps: [{ requestHeaders: { Authorization: 'Bearer secret-token' }, requestBody: null }] })),
  },
  playbookStep: { findMany: vi.fn(async () => []), deleteMany: vi.fn(), update: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(async () => []),
  endpoint: {
    findMany: vi.fn(async () => [{ method: 'GET', pathTemplate: '/a', sortOrder: 4 }]),
    createMany: vi.fn(async () => ({ count: 1 })),
  },
}))
vi.mock('@erp/db', () => ({ prisma: db }))

import { getCompanies, getCompany } from './companies'
import { getRecordForEdit } from '@/app/actions/records'
import { upsertPlaybookSteps, getPlaybookRun } from './playbooks'
import { importOpenApi } from './endpoints'

beforeEach(() => {
  authState.role = 'viewer'
  vi.clearAllMocks()
})

describe('company credentials leaving the server', () => {
  const secretIn = (v: unknown) => JSON.stringify(v).includes('secret-token')

  it('are masked for viewers', async () => {
    expect(secretIn(await getCompanies())).toBe(false)
    expect(secretIn(await getCompany(1))).toBe(false)
    expect(secretIn(await getRecordForEdit(1))).toBe(false)
    expect(secretIn(await getPlaybookRun(1))).toBe(false)
  })

  it('are intact for editors', async () => {
    authState.role = 'editor'
    expect(secretIn(await getCompanies())).toBe(true)
    expect(secretIn(await getCompany(1))).toBe(true)
    expect(secretIn(await getRecordForEdit(1))).toBe(true)
    expect(secretIn(await getPlaybookRun(1))).toBe(true)
  })
})

describe('playbook steps', () => {
  const steps = [{ order: 0, endpointId: 1, stepName: 's', bodyOverride: '', responseCapture: '' }]

  it('only admins can rewrite steps', async () => {
    for (const role of ['viewer', 'editor']) {
      authState.role = role
      await expect(upsertPlaybookSteps(1, steps)).rejects.toThrow('Permissão insuficiente')
    }
    expect(db.$transaction).not.toHaveBeenCalled()
    authState.role = 'admin'
    await upsertPlaybookSteps(1, steps)
    expect(db.$transaction).toHaveBeenCalledOnce()
  })
})

describe('importOpenApi', () => {
  const spec = JSON.stringify({ openapi: '3.0.0', paths: { '/a': { get: {} }, '/b': { post: { summary: 'Criar B' } } } })

  it('is admin-only', async () => {
    authState.role = 'editor'
    await expect(importOpenApi(1, spec)).rejects.toThrow('Permissão insuficiente')
    expect(db.endpoint.createMany).not.toHaveBeenCalled()
  })

  it('skips operations already registered and appends after the last endpoint', async () => {
    authState.role = 'admin'
    expect(await importOpenApi(1, spec)).toEqual({ created: 1, skipped: 1, warnings: [] })
    const [{ data }] = db.endpoint.createMany.mock.calls[0] as unknown as [{ data: Record<string, unknown>[] }]
    expect(data).toEqual([expect.objectContaining({ erpId: 1, name: 'Criar B', method: 'POST', pathTemplate: '/b', sortOrder: 5 })])
  })

  it('explains non-JSON files', async () => {
    authState.role = 'admin'
    await expect(importOpenApi(1, 'openapi: 3.0.0')).rejects.toThrow('não é JSON válido')
  })
})
