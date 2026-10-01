'use client'

import { usePathname } from 'next/navigation'
import { useLayoutEffect, useRef } from 'react'

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || pathname.endsWith('/view')) return
    el.style.opacity = '0'
    el.style.transform = 'translateY(10px)'
    el.style.transition = 'none'
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = 'opacity 0.22s ease, transform 0.22s ease'
        el.style.opacity = '1'
        el.style.transform = 'none'
      })
    })
  }, [pathname])

  return <div ref={ref}>{children}</div>
}
