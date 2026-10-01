// @vitest-environment jsdom
import { vi, beforeEach, test, expect } from 'vitest'
import { getTheme, setTheme, toggleTheme } from './theme'

// jsdom v28+ localStorage doesn't implement Web Storage API by default
const store: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value },
  removeItem: (key: string) => { delete store[key] },
  clear: () => { for (const key in store) delete store[key] },
})

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme')
  localStorage.clear()
})

test('getTheme returns dark by default', () => {
  expect(getTheme()).toBe('dark')
})

test('setTheme applies data-theme attribute', () => {
  setTheme('light')
  expect(document.documentElement.getAttribute('data-theme')).toBe('light')
})

test('setTheme persists to localStorage', () => {
  setTheme('light')
  expect(localStorage.getItem('theme')).toBe('light')
})

test('toggleTheme switches dark to light', () => {
  setTheme('dark')
  toggleTheme()
  expect(getTheme()).toBe('light')
})

test('toggleTheme switches light to dark', () => {
  setTheme('light')
  toggleTheme()
  expect(getTheme()).toBe('dark')
})
