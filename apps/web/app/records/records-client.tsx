'use client'

import { useState, useTransition, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { createRecord, deleteRecord, createCategory } from '@/app/actions/records'
import { FileText, Plus, Trash2, ChevronRight } from 'lucide-react'
import { useRole } from '@/lib/role-context'
import { PageHeader } from '@/components/ui/page-header'

type RecordItem = {
  id: number
  name: string
  createdAt: Date
  company: { id: number; name: string; erp: { id: number; name: string } }
  category: { id: number; name: string } | null
  _count: { blocks: number }
}

type Company = { id: number; name: string }
type Erp = { id: number; name: string; companies: Company[] }
type Category = { id: number; name: string }

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', fontSize: 13, borderRadius: 6,
  border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)',
  color: 'var(--text)', outline: 'none', width: '100%',
}

function NewRecordModal({
  erps,
  categories,
  onClose,
  onCreate,
}: {
  erps: Erp[]
  categories: Category[]
  onClose: () => void
  onCreate: (id: number) => void
}) {
  const [erpId, setErpId] = useState<number | ''>(erps[0]?.id ?? '')
  const [companyId, setCompanyId] = useState<number | ''>(erps[0]?.companies[0]?.id ?? '')
  const [categoryId, setCategoryId] = useState<number | 'new' | ''>('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [isPending, start] = useTransition()

  const companies = erps.find((e) => e.id === erpId)?.companies ?? []

  const handleErpChange = (id: number) => {
    setErpId(id)
    const first = erps.find((e) => e.id === id)?.companies[0]
    setCompanyId(first?.id ?? '')
  }

  const submit = () => {
    if (!companyId) return
    start(async () => {
      let resolvedCategoryId: number | null = null
      if (categoryId === 'new' && newCategoryName.trim()) {
        const cat = await createCategory(newCategoryName.trim())
        resolvedCategoryId = cat.id
      } else if (categoryId && categoryId !== 'new') {
        resolvedCategoryId = Number(categoryId)
      }
      const allCompanies = erps.flatMap((e) => e.companies)
      const companyName = allCompanies.find((c) => c.id === Number(companyId))?.name ?? ''
      const rec = await createRecord(companyName, Number(companyId), resolvedCategoryId)
      onCreate(rec.id)
    })
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={onClose}
    >
      <div
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, width: 380, display: 'flex', flexDirection: 'column', gap: 16 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>Novo registro</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>ERP</label>
          <select value={erpId} onChange={(e) => handleErpChange(Number(e.target.value))} style={selectStyle}>
            {erps.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Empresa</label>
          <select value={companyId} onChange={(e) => setCompanyId(Number(e.target.value))} style={selectStyle} disabled={companies.length === 0}>
            {companies.length === 0
              ? <option>Nenhuma empresa neste ERP</option>
              : companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
            }
          </select>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Categoria <span style={{ color: 'var(--text-subtle)' }}>(opcional)</span></label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value === 'new' ? 'new' : e.target.value ? Number(e.target.value) : '')}
            style={selectStyle}
          >
            <option value="">Sem categoria</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="new">+ Nova categoria…</option>
          </select>
          {categoryId === 'new' && (
            <input
              autoFocus
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Nome da categoria"
              style={{ ...selectStyle, border: '1px solid var(--accent)' }}
            />
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={!companyId || isPending || (categoryId === 'new' && !newCategoryName.trim())}
            style={{ padding: '6px 14px', fontSize: 13, borderRadius: 6, border: 'none', backgroundColor: 'var(--accent)', color: 'white', cursor: 'pointer', opacity: (!companyId || isPending || (categoryId === 'new' && !newCategoryName.trim())) ? 0.5 : 1 }}
          >
            {isPending ? 'Criando…' : 'Criar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function RecordsClient({
  records: initial,
  erps,
  categories,
}: {
  records: RecordItem[]
  erps: Erp[]
  categories: Category[]
}) {
  const [records, setRecords] = useState(initial)
  const [showNew, setShowNew] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [activeFilter, setActiveFilter] = useState<number | null>(null)
  const router = useRouter()
  const { canEdit } = useRole()

  const handleCreate = (id: number) => {
    setShowNew(false)
    router.push(`/records/${id}`)
  }

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    setDeletingId(id)
    await deleteRecord(id)
    setRecords((prev) => prev.filter((r) => r.id !== id))
    setDeletingId(null)
  }

  const filtered = activeFilter === null
    ? records
    : records.filter((r) => r.category?.id === activeFilter)

  const usedCategories = categories.filter((c) => records.some((r) => r.category?.id === c.id))

  const groups = Object.values(
    filtered.reduce<Record<string, { erpName: string; items: RecordItem[] }>>((acc, rec) => {
      const key = rec.company.erp.name
      if (!acc[key]) acc[key] = { erpName: key, items: [] }
      acc[key].items.push(rec)
      return acc
    }, {})
  ).sort((a, b) => a.erpName.localeCompare(b.erpName))

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 12px',
    fontSize: 12,
    fontWeight: active ? 500 : 400,
    borderRadius: 20,
    border: active ? 'none' : '1px solid var(--border)',
    backgroundColor: active ? 'var(--accent)' : 'transparent',
    color: active ? 'white' : 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 0.1s',
  })

  return (
    <>
      {showNew && (
        <NewRecordModal
          erps={erps}
          categories={categories}
          onClose={() => setShowNew(false)}
          onCreate={handleCreate}
        />
      )}

      <div style={{ padding: '32px 40px' }}>
        <PageHeader
          title="Registros"
          description="Documente sequências de requisições e compartilhe com o time."
          action={
            canEdit ? (
              <button
                onClick={() => setShowNew(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 13, borderRadius: 6, border: 'none', backgroundColor: 'var(--accent)', color: 'white', cursor: 'pointer', fontWeight: 500 }}
              >
                <Plus size={14} /> Novo registro
              </button>
            ) : undefined
          }
        />

        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {usedCategories.length > 0 && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button style={chipStyle(activeFilter === null)} onClick={() => setActiveFilter(null)}>Todos</button>
              {usedCategories.map((c) => (
                <button key={c.id} style={chipStyle(activeFilter === c.id)} onClick={() => setActiveFilter(activeFilter === c.id ? null : c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
          )}

          {records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <FileText size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 6 }}>Nenhum registro ainda</div>
              <div style={{ fontSize: 13 }}>Crie um registro para documentar e compartilhar testes.</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              Nenhum registro nesta categoria.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Nome</th>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Blocos</th>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Data</th>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>Categoria</th>
                  <th style={{ padding: '8px 16px' }} />
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.erpName}>
                    <tr>
                      <td colSpan={5} style={{ padding: '8px 16px', backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-subtle)' }}>
                        {group.erpName}
                      </td>
                    </tr>
                    {group.items.map((rec, i) => (
                      <tr
                        key={rec.id}
                        onClick={() => router.push(`/records/${rec.id}`)}
                        style={{ borderBottom: i < group.items.length - 1 ? '1px solid var(--border)' : undefined, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-2)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '10px 16px', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {rec.company.name}
                            <ChevronRight size={13} color="var(--text-subtle)" />
                          </span>
                        </td>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-muted)' }}>{rec._count.blocks} bloco{rec._count.blocks !== 1 ? 's' : ''}</td>
                        <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--text-subtle)' }}>{new Date(rec.createdAt).toLocaleDateString('pt-BR')}</td>
                        <td style={{ padding: '10px 16px' }}>
                          {rec.category && (
                            <span style={{ fontSize: 11, color: 'var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)', padding: '1px 7px', borderRadius: 10, fontWeight: 500 }}>
                              {rec.category.name}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '10px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                            {canEdit && (
                              <button
                                onClick={(e) => handleDelete(e, rec.id)}
                                disabled={deletingId === rec.id}
                                style={{ padding: '4px 6px', borderRadius: 5, border: 'none', backgroundColor: 'transparent', color: 'var(--text-subtle)', cursor: 'pointer', opacity: deletingId === rec.id ? 0.4 : 1 }}
                                title="Deletar"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                            <ChevronRight size={14} style={{ color: 'var(--text-subtle)' }} />
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
    </>
  )
}
