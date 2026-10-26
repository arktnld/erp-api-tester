/** Text copy for HTTPS and HTTP, with success feedback only after an actual copy. */
export async function copyText(text: string, onCopied?: () => void): Promise<boolean> {
  let copied = false
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      copied = true
    }
  } catch { /* Try the HTTP-compatible path if permission was denied. */ }

  if (!copied) {
    const active = document.activeElement as HTMLElement | null
    const selection = window.getSelection()
    const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, i) => selection.getRangeAt(i).cloneRange()) : []
    const input = document.createElement('textarea')
    input.value = text
    input.readOnly = true
    input.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none'
    // Stay inside a modal's focus trap when copying a newly generated password.
    const container = active?.closest('[role="dialog"],dialog,[aria-modal="true"]') ?? document.body
    container.appendChild(input)
    try {
      input.focus()
      input.select()
      input.setSelectionRange(0, text.length)
      copied = document.execCommand('copy')
    } catch { copied = false } finally {
      input.remove()
      active?.focus({ preventScroll: true })
      if (selection) {
        selection.removeAllRanges()
        ranges.forEach((range) => selection.addRange(range))
      }
    }
  }

  if (copied) onCopied?.()
  else window.alert('Não foi possível copiar. Selecione o texto e copie manualmente com Ctrl+C.')
  return copied
}
