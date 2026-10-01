'use client'

import { useState } from 'react'

export function useExport(cardRef: React.RefObject<HTMLDivElement | null>) {
  const [copyCapturing, setCopyCapturing] = useState(false)
  const [downloadCapturing, setDownloadCapturing] = useState(false)
  const [imageCopied, setImageCopied] = useState(false)
  const capturing = copyCapturing || downloadCapturing

  async function capture() {
    if (!cardRef.current) return null
    const { toPng } = await import('html-to-image')
    return toPng(cardRef.current, { pixelRatio: 2, skipFonts: true })
  }

  async function copyImage() {
    setCopyCapturing(true)
    try {
      if (window.isSecureContext) {
        const { toBlob } = await import('html-to-image')
        if (!cardRef.current) return
        const blob = await toBlob(cardRef.current, { pixelRatio: 2, skipFonts: true })
        if (!blob) return
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        setImageCopied(true)
        setTimeout(() => setImageCopied(false), 1800)
      } else {
        // HTTP fallback: open image in new tab so user can copy/save
        const dataUrl = await capture()
        if (!dataUrl) return
        window.open(dataUrl, '_blank')
      }
    } finally {
      setCopyCapturing(false)
    }
  }

  async function downloadPng() {
    setDownloadCapturing(true)
    try {
      const dataUrl = await capture()
      if (!dataUrl) return
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `resultado-api-${Date.now()}.png`
      a.click()
    } finally {
      setDownloadCapturing(false)
    }
  }

  return { capturing, copyCapturing, downloadCapturing, imageCopied, copyImage, downloadPng }
}
