'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Server, Building2, FlaskConical, History, BookMarked, ListChecks, Settings, PanelLeftClose, PanelLeftOpen, FileText, LogOut, type LucideIcon } from 'lucide-react'
import { logout } from '@/app/sign-in/actions'
import type { SessionUser } from '@/lib/session'
import { Avatar } from '@/components/ui/avatar'
import { TourButton } from '@/components/ui/tour-button'
import { useSidebar, SIDEBAR_WIDTH } from './sidebar-context'
// Static imports get a content-hashed URL with a 1-year immutable cache (public/ files are revalidated on every load).
import logoDark from '@/assets/brand/logo-dark.png'
import logoLight from '@/assets/brand/logo-light.png'

type NavItem =
  | { type: 'section'; label: string }
  | { type: 'spacer' }
  | { type: 'link'; href: string; label: string; icon: LucideIcon; tourId: string; count?: number }

type SidebarERP = {
  id: number
  name: string
  companies: { id: number; name: string }[]
  endpoints: { id: number; name: string; method: string }[]
}

export function Sidebar({ user, erps, playbookCount, recordCount, historyCount, collectionCount }: { user: SessionUser | null; erps: SidebarERP[]; playbookCount: number; recordCount: number; historyCount: number; collectionCount: number }) {
  const pathname = usePathname()
  const { collapsed, toggle } = useSidebar()

  if (!user || pathname.startsWith('/sign-in') || pathname.endsWith('/view')) return null

  const nav: NavItem[] = [
    { type: 'section', label: 'API' },
    { type: 'link', href: '/test', label: 'Testar API', icon: FlaskConical, tourId: 'test' },
    { type: 'link', href: '/playbooks', label: 'Fluxos', icon: ListChecks, tourId: 'playbooks', count: playbookCount },
    { type: 'link', href: '/records', label: 'Registros', icon: FileText, tourId: 'records', count: recordCount },
    { type: 'section', label: 'Dados' },
    { type: 'link', href: '/erps', label: 'ERPs', icon: Server, tourId: 'erps', count: erps.length },
    { type: 'link', href: '/companies', label: 'Empresas', icon: Building2, tourId: 'companies', count: erps.reduce((n, e) => n + e.companies.length, 0) },
    { type: 'section', label: 'Info' },
    { type: 'link', href: '/history', label: 'Histórico', icon: History, tourId: 'history', count: historyCount },
    { type: 'link', href: '/collections', label: 'Documentação', icon: BookMarked, tourId: 'collections', count: collectionCount },
    { type: 'spacer' },
    { type: 'link', href: '/settings', label: 'Configurações', icon: Settings, tourId: 'settings' },
  ]

  const W = collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded

  return (
    <aside
      style={{
        width: W,
        minWidth: W,
        height: '100vh',
        backgroundColor: 'var(--nav-bg)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 50,
        transition: 'width 0.18s ease, min-width 0.18s ease',
        overflow: 'hidden',
      }}
    >
      {/* Logo + toggle */}
      <div
        style={{
          padding: collapsed ? '14px 0' : '14px 12px 14px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 0,
          flexShrink: 0,
          transition: 'padding 0.18s ease',
        }}
      >
        {!collapsed && (
          <Link href="/" style={{ display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no optimization needed */}
            <img src={logoDark.src} alt="ERP Tester" width={120} height={40} className="brand-logo brand-on-dark" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoLight.src} alt="ERP Tester" width={120} height={40} className="brand-logo brand-on-light" />
          </Link>
        )}
        <button
          onClick={toggle}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            borderRadius: 'var(--radius)',
            border: 'none',
            background: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.12s, color 0.12s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--surface-3)'
            e.currentTarget.style.color = 'var(--text)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none'
            e.currentTarget.style.color = 'var(--text-muted)'
          }}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {/* Nav */}
      <div data-tour="nav" style={{ flex: 1, overflowY: 'auto', padding: '8px 8px', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {nav.map((item, i) => {
          if (item.type === 'spacer') {
            return <div key={i} style={{ flex: 1 }} />
          }
          if (item.type === 'section') {
            if (collapsed) return null
            return (
              <span key={i} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-subtle)', padding: '14px 10px 4px', userSelect: 'none' }}>
                {item.label}
              </span>
            )
          }
          const { href, label, icon: Icon, tourId, count } = item
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <div key={href} {...(tourId ? { 'data-tour': tourId } : {})}>
              <Link
                href={href}
                title={collapsed ? label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: collapsed ? 0 : 10,
                  padding: collapsed ? '8px 0' : '7px 10px',
                  borderRadius: 'var(--radius)',
                  marginBottom: 1,
                  color: active ? 'var(--text-strong)' : 'var(--text)',
                  backgroundColor: active ? 'var(--surface-3)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  transition: 'background-color 0.1s, color 0.1s, border-color 0.1s',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'var(--surface-3)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }
                }}
              >
                <Icon size={16} style={{ flexShrink: 0, color: active ? 'var(--accent)' : 'var(--text-muted)' }} />
                {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
                {!collapsed && count !== undefined && <span className="g-counter">{count}</span>}
              </Link>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div
        data-tour="footer"
        style={{
          padding: collapsed ? '8px 0' : '8px 12px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          flexShrink: 0,
          transition: 'padding 0.18s ease',
        }}
      >
        <Link
          href="/settings"
          title={`${user.name || user.email} — minha conta`}
          style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, color: 'var(--text)', textDecoration: 'none' }}
        >
          <Avatar name={user.name || user.email} />
          {!collapsed && <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name || user.email}</span>}
        </Link>
        {!collapsed && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <TourButton />
            <form action={logout}>
              <button type="submit" title="Sair" aria-label="Sair" style={{ display: 'flex', alignItems: 'center', padding: 6, background: 'none', border: 'none', borderRadius: 'var(--radius)', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <LogOut size={15} />
              </button>
            </form>
          </div>
        )}
      </div>
    </aside>
  )
}
