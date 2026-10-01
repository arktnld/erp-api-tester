import { notFound } from 'next/navigation'
import { prisma } from '@erp/db'
import { ViewContent, type BlockResponse } from './view-content'
import { redactBody, redactHeaders } from '@/lib/redact'

// Public page (see middleware): the segment carries the record's shareToken, never its numeric id.
export default async function RecordViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: token } = await params
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound()

  const record = await prisma.apiRecord.findUnique({
    where: { shareToken: token },
    include: {
      company: { select: { name: true } },
      category: { select: { name: true } },
      blocks: {
        orderBy: { order: 'asc' },
        select: { id: true, order: true, endpointId: true, clientId: true, response: true, note: true, executedAt: true },
      },
    },
  })

  if (!record) notFound()

  const endpointIds = record.blocks.map((b) => b.endpointId).filter(Boolean) as number[]
  const endpoints = endpointIds.length
    ? await prisma.endpoint.findMany({ where: { id: { in: endpointIds } }, select: { id: true, name: true, method: true, pathTemplate: true } })
    : []

  const clientIds = record.blocks.map((b) => b.clientId).filter(Boolean) as number[]
  const clients = clientIds.length
    ? await prisma.testClient.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true } })
    : []

  const epMap = Object.fromEntries(endpoints.map((e) => [e.id, e]))
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]))

  const blocks = record.blocks.map((b) => ({
    id: b.id,
    order: b.order,
    note: b.note ?? '',
    executedAt: b.executedAt,
    response: redactResponse(b.response as BlockResponse | null),
    endpoint: b.endpointId ? epMap[b.endpointId] ?? null : null,
    client: b.clientId ? clientMap[b.clientId] ?? null : null,
  }))

  return (
    <ViewContent
      recordName={record.name}
      companyName={record.company.name}
      categoryName={record.category?.name ?? null}
      createdAt={record.createdAt}
      notes={record.notes ?? ''}
      blocks={blocks}
    />
  )
}

function redactResponse(r: BlockResponse | null): BlockResponse | null {
  if (!r) return r
  return { ...r, requestHeaders: r.requestHeaders && redactHeaders(r.requestHeaders), requestBody: redactBody(r.requestBody) }
}
