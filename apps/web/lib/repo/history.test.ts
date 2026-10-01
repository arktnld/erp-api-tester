import { describe, it, expect, vi } from 'vitest'

const db = vi.hoisted(() => ({
  requestHistory: { create: vi.fn(async () => ({ id: 1 })), deleteMany: vi.fn(async () => ({ count: 5 })) },
}))
vi.mock('@erp/db', () => ({ prisma: db }))

import { pruneHistory, recordExecution, HISTORY_RETENTION_DAYS } from './history'

describe('history retention', () => {
  it('deletes rows older than the retention window, at most once per hour', async () => {
    const now = Date.UTC(2026, 8, 27)
    expect(await pruneHistory(now)).toBe(5)
    const cutoff = (db.requestHistory.deleteMany.mock.calls[0] as unknown as [{ where: { createdAt: { lt: Date } } }])[0].where.createdAt.lt
    expect(now - cutoff.getTime()).toBe(HISTORY_RETENTION_DAYS * 86_400_000)
    expect(await pruneHistory(now + 30 * 60_000)).toBe(0)
    expect(await pruneHistory(now + 61 * 60_000)).toBe(5)
    expect(db.requestHistory.deleteMany).toHaveBeenCalledTimes(2)
  })

  it('records the execution even if cleanup fails', async () => {
    db.requestHistory.deleteMany.mockRejectedValueOnce(new Error('db down'))
    await expect(recordExecution({} as never)).resolves.toEqual({ id: 1 })
  })
})
