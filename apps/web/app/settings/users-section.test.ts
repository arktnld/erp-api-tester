// @vitest-environment jsdom
import * as React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { NewPassword } from './users-section'

vi.mock('./actions', () => ({ updateUserName: vi.fn(), resetUserPassword: vi.fn(), deleteUser: vi.fn() }))

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = '' })

it.each([true, false])('password copy on HTTP only reports success when copying succeeds (%s)', async (success) => {
  vi.stubGlobal('React', React)
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
  const exec = vi.fn(() => {
    expect(document.querySelector('textarea')?.value).toBe('generated-password')
    return success
  })
  Object.defineProperty(document, 'execCommand', { configurable: true, value: exec })
  vi.spyOn(window, 'alert').mockImplementation(() => {})
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  try {
    await act(async () => { root.render(React.createElement(NewPassword, { password: 'generated-password' })) })
    await act(async () => { container.querySelector('button')!.click() })
    expect(exec).toHaveBeenCalledWith('copy')
    expect(container.querySelector('button')!.textContent).toBe(success ? 'Copiada' : 'Copiar')
    await act(async () => { root.render(React.createElement(NewPassword, { password: 'another-password' })) })
    expect(container.querySelector('button')!.textContent).toBe('Copiar')
  } finally {
    await act(async () => { root.unmount() })
  }
})
