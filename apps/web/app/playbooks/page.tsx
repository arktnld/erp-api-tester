import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Fluxos' }

import { Fragment } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getPlaybooks } from '@/lib/actions/playbooks'
import { PageHeader } from '@/components/ui/page-header'
import { NewPlaybookButton, CreatePlaybookLink, PlaybookEditActions } from './playbooks-actions'

export const dynamic = 'force-dynamic'

export default async function PlaybooksPage() {
  const playbooks = await getPlaybooks()

  const byErp = new Map<number, { erpName: string; items: typeof playbooks }>()
  for (const pb of playbooks) {
    if (!byErp.has(pb.erpId)) byErp.set(pb.erpId, { erpName: pb.erp.name, items: [] })
    byErp.get(pb.erpId)!.items.push(pb)
  }

  return (
    <div style={{ padding: '32px 40px' }}>
      <PageHeader
        title="Fluxos"
        description="Sequências de requisições com encadeamento de respostas"
        action={<NewPlaybookButton />}
      />

      <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {playbooks.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 13 }}>
            Nenhum fluxo criado.{' '}
            <CreatePlaybookLink />
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Nome</th>
                <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Steps</th>
                <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Execuções</th>
                <th style={{ padding: '8px 16px' }} />
              </tr>
            </thead>
            <tbody>
              {Array.from(byErp.values()).map(({ erpName, items }) => (
                <Fragment key={erpName}>
                  <tr>
                    <td colSpan={4} style={{ padding: '8px 16px', backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-subtle)' }}>
                      {erpName}
                    </td>
                  </tr>
                  {items.map((pb, i) => (
                    <tr key={pb.id} className="card-hover" style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border)' : undefined }}>
                      <td style={{ padding: '10px 16px' }}>
                        <Link href={`/playbooks/${pb.id}`} style={{ textDecoration: 'none', color: 'var(--text)', fontWeight: 500, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {pb.name}
                          <ChevronRight size={13} color="var(--text-subtle)" />
                        </Link>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-muted)' }}>
                        {pb._count.steps} step{pb._count.steps !== 1 ? 's' : ''}
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-subtle)' }}>
                        {pb._count.runs > 0 ? `${pb._count.runs} execuç${pb._count.runs !== 1 ? 'ões' : 'ão'}` : '–'}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                          <PlaybookEditActions id={pb.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
