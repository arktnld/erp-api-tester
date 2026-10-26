// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyText } from './clipboard'

describe('copyText', () => {
  const exec = vi.fn(() => true)
  const alert = vi.fn()
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    Object.defineProperty(document, 'execCommand', { configurable: true, value: exec })
    vi.spyOn(window, 'alert').mockImplementation(alert)
    exec.mockReset().mockReturnValue(true)
    alert.mockClear()
  })
  afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })

  it('copies through the modern API and confirms only after completion', async () => {
    let finish!: () => void
    const writeText = vi.fn(() => new Promise<void>((resolve) => { finish = resolve }))
    Object.defineProperty(navigator, 'clipboard', { value: { writeText } })
    const done = vi.fn()
    const result = copyText('password', done)
    expect(done).not.toHaveBeenCalled()
    finish()
    expect(await result).toBe(true)
    expect(writeText).toHaveBeenCalledWith('password')
    expect(done).toHaveBeenCalledOnce()
    expect(exec).not.toHaveBeenCalled()
  })

  it('copies on HTTP inside a modal, cleans up and restores focus and selection', async () => {
    document.body.innerHTML = '<div role="dialog"><button>Copy</button><span>Original</span></div>'
    const button = document.querySelector('button')!
    button.focus()
    const range = document.createRange()
    range.selectNodeContents(document.querySelector('span')!)
    window.getSelection()!.removeAllRanges()
    window.getSelection()!.addRange(range)
    exec.mockImplementationOnce(() => {
      const input = document.querySelector('textarea')!
      expect(input.closest('[role="dialog"]')).not.toBeNull()
      expect(input.value).toBe('password')
      expect(input.selectionStart).toBe(0)
      expect(input.selectionEnd).toBe(8)
      return true
    })
    expect(await copyText('password')).toBe(true)
    expect(exec).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
    expect(document.activeElement).toBe(button)
    expect(window.getSelection()!.toString()).toBe('Original')
  })

  it('falls back when the clipboard permission is denied', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } })
    expect(await copyText('text')).toBe(true)
    expect(exec).toHaveBeenCalledOnce()
  })

  it.each(['false', 'throws'])('reports failure without claiming success when copy %s', async (failure) => {
    if (failure === 'false') exec.mockReturnValue(false)
    else exec.mockImplementation(() => { throw new Error('Blocked') })
    const done = vi.fn()
    expect(await copyText('password', done)).toBe(false)
    expect(done).not.toHaveBeenCalled()
    expect(alert).toHaveBeenCalledOnce()
    expect(document.querySelector('textarea')).toBeNull()
  })
})
