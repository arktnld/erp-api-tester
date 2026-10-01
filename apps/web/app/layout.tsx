import type { Metadata } from 'next'
import { Sidebar } from '@/components/layout/sidebar'
import { CommandPalette } from '@/components/ui/command-palette'
import { MainContent } from '@/components/layout/main-content'
import NextTopLoader from 'nextjs-toploader'
import { SidebarProvider } from '@/components/layout/sidebar-context'
import { RoleProvider } from '@/lib/role-context'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@erp/db'
import './globals.css'

export const metadata: Metadata = {
  title: { template: '%s', default: 'ERP Tester' },
  description: 'Internal API testing tool for ERP systems',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  // Anonymous pages (login, shared record link) get no navigation data at all.
  const [erps, playbookCount, recordCount, historyCount, collectionCount] = !user ? [[], 0, 0, 0, 0] : await Promise.all([
    prisma.eRP.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        companies: {
          orderBy: { name: 'asc' },
          select: { id: true, name: true },
        },
        endpoints: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, name: true, method: true, pathTemplate: true },
        },
      },
    }),
    prisma.playbook.count(),
    prisma.apiRecord.count(),
    prisma.requestHistory.count(),
    prisma.postmanCollection.count(),
  ])

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before paint, so a light-theme user never sees a dark flash. */}
        <script dangerouslySetInnerHTML={{ __html: "try{if(localStorage.getItem('theme')==='light')document.documentElement.setAttribute('data-theme','light')}catch(e){}" }} />
      </head>
      <body>
        <NextTopLoader color="var(--accent)" showSpinner={false} height={2} />
        <RoleProvider role={user?.role ?? 'viewer'}>
          <CommandPalette erps={erps} />
          <SidebarProvider>
            <Sidebar user={user} erps={erps} playbookCount={playbookCount} recordCount={recordCount} historyCount={historyCount} collectionCount={collectionCount} />
            <MainContent>{children}</MainContent>
          </SidebarProvider>
        </RoleProvider>
      </body>
    </html>
  )
}
