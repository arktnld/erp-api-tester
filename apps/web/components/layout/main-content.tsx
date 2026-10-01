'use client'

import { usePathname } from 'next/navigation'
import { PageTransition } from './page-transition'
import { useSidebar, SIDEBAR_WIDTH } from './sidebar-context'

export function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAuth = pathname.startsWith('/sign-in')
  const isView = pathname.endsWith('/view')
  const { collapsed } = useSidebar()

  return (
    <main
      style={{
        marginLeft: (isAuth || isView) ? 0 : collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded,
        minHeight: '100vh',
        backgroundColor: 'var(--background)',
        transition: 'margin-left 0.18s ease',
      }}
    >
      <PageTransition>{children}</PageTransition>
    </main>
  )
}
