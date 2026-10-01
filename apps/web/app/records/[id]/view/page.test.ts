import { describe, it, expect, vi } from 'vitest'

const TOKEN = '3f1c2b9a-8d4e-4f6a-9b7c-1a2b3c4d5e6f'
const record = {
  id: 1, name: 'R', notes: '', createdAt: new Date(), category: null, company: { name: 'C' },
  blocks: [{
    id: 1, order: 1, endpointId: null, clientId: null, note: '', executedAt: null,
    response: { requestHeaders: { Authorization: 'Bearer secret-token', Accept: '*/*' }, requestBody: '{"password":"secret-pass","cnpj":"1"}' },
  }],
}
const db = vi.hoisted(() => ({
  apiRecord: { findUnique: vi.fn(async ({ where }: { where: { shareToken?: string } }) => (where.shareToken === TOKEN ? record : null)) },
  endpoint: { findMany: vi.fn(async () => []) },
  testClient: { findMany: vi.fn(async () => []) },
}))
vi.mock('@erp/db', () => ({ prisma: db }))
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND') } }))
vi.mock('./view-content', () => ({ ViewContent: () => null }))

import RecordViewPage from './page'

const render = (id: string) => RecordViewPage({ params: Promise.resolve({ id }) })

describe('public record view', () => {
  it('does not resolve sequential ids', async () => {
    await expect(render('1')).rejects.toThrow('NOT_FOUND')
    expect(db.apiRecord.findUnique).not.toHaveBeenCalled()
  })

  it('serves a shared record by token with credentials masked', async () => {
    const el = await render(TOKEN)
    const json = JSON.stringify(el.props)
    expect(json).not.toContain('secret-token')
    expect(json).not.toContain('secret-pass')
    expect(json).toContain('"cnpj\\":\\"1\\"')
  })
})
