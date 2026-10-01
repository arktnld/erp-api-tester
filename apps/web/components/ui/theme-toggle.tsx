'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { getTheme, toggleTheme, type Theme } from '@/lib/theme'
import { Button } from './button'

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>('dark')

  useEffect(() => {
    setThemeState(getTheme())
  }, [])

  function handleToggle() {
    toggleTheme()
    setThemeState(getTheme())
  }

  return (
    <Button variant="ghost" size="icon" onClick={handleToggle} title="Toggle theme">
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </Button>
  )
}
