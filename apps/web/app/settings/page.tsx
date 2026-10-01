import type { Metadata } from 'next'
export const metadata: Metadata = { title: 'Configurações' }

import { Download } from 'lucide-react'
import { requireUser } from '@/lib/require-role'
import { canAdmin, getRoleLabel } from '@/lib/roles'
import { PageHeader } from '@/components/ui/page-header'
import { Avatar } from '@/components/ui/avatar'
import { AdminSections } from './admin-sections'
import { AccountSection } from './account-section'
import { ThemeChoice } from './theme-choice'

const rowText = { title: { fontSize: 14, fontWeight: 600, color: 'var(--text-strong)' }, desc: { fontSize: 12, color: 'var(--text-muted)', marginTop: 2 } } as const

export default async function SettingsPage() {
  const me = await requireUser()
  const isAdmin = canAdmin(me.role)

  return (
    <div style={{ padding: '32px 40px', maxWidth: 960 }}>
      <PageHeader title="Configurações" description="Sua conta, a aparência do site e, para admins, dados e usuários" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <section className="g-box" aria-labelledby="s-conta">
          <div id="s-conta" className="g-box-header">Minha conta</div>
          <div className="g-box-row" style={{ gap: 14 }}>
            <Avatar name={me.name || me.email} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={rowText.title}>{me.name || 'Sem nome'}</div>
              <div style={rowText.desc}>{me.email}</div>
            </div>
            <span className="g-counter" style={{ height: 22, padding: '0 10px', fontSize: 12 }}>{getRoleLabel(me.role)}</span>
          </div>
          <AccountSection email={me.email} />
        </section>

        <section className="g-box" aria-labelledby="s-aparencia">
          <div id="s-aparencia" className="g-box-header">Aparência</div>
          <div className="g-box-row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div style={rowText.title}>Tema</div>
              <div style={rowText.desc}>Vale só para este navegador</div>
            </div>
            <ThemeChoice />
          </div>
        </section>

        {isAdmin && (
          <section className="g-box" aria-labelledby="s-dados">
            <div id="s-dados" className="g-box-header">Dados</div>
            <div className="g-box-row" style={{ justifyContent: 'space-between' }}>
              <div>
                <div style={rowText.title}>Exportar backup</div>
                <div style={rowText.desc}>ERPs, empresas, endpoints e clientes de teste em JSON, com as credenciais</div>
              </div>
              <a href="/api/backup" download className="btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
                <Download size={14} /> Exportar
              </a>
            </div>
          </section>
        )}

        {isAdmin && <AdminSections currentUserId={me.id} />}
      </div>
    </div>
  )
}
