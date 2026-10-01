import { prisma } from '@erp/db'

export interface RecordExecutionData {
  erpName: string
  companyName: string
  companyId: number
  endpointId: number
  testClientId?: number
  endpointName: string
  clientName: string
  method: string
  url: string
  requestBody: string
  requestHeaders: string
  statusCode: number
  responseBody: string
  responseHeaders: string
  durationMs: number
  userId?: string
  userEmail?: string
}

// ponytail: fixed retention, pruned lazily from the write path (no cron). Make it a setting if teams need different windows.
export const HISTORY_RETENTION_DAYS = 90
const PRUNE_INTERVAL_MS = 60 * 60 * 1000
let lastPruneAt = 0

/** Deletes history older than the retention window, at most once per hour per process. */
export async function pruneHistory(now = Date.now()) {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return 0
  lastPruneAt = now
  const cutoff = new Date(now - HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const { count } = await prisma.requestHistory.deleteMany({ where: { createdAt: { lt: cutoff } } })
  return count
}

export async function recordExecution(data: RecordExecutionData) {
  const row = await prisma.requestHistory.create({ data })
  await pruneHistory().catch(() => 0) // never fail an execution because cleanup failed
  return row
}
