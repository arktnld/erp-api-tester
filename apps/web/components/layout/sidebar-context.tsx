'use client'

import { createContext, useContext, useState } from 'react'

export const SIDEBAR_WIDTH = { expanded: 232, collapsed: 56 }

type SidebarCtx = { collapsed: boolean; toggle: () => void }

const SidebarContext = createContext<SidebarCtx>({ collapsed: false, toggle: () => {} })

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <SidebarContext.Provider value={{ collapsed, toggle: () => setCollapsed((v) => !v) }}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = () => useContext(SidebarContext)
