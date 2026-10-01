'use client'

import { useEffect, useState } from 'react'
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/light'
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json'
import xml from 'react-syntax-highlighter/dist/esm/languages/hljs/xml'
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs'

SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('xml', xml)

type Props = {
  language: string
  children: string
  customStyle?: React.CSSProperties
  wrapLongLines?: boolean
}

export function CodeBlock({ language, children, customStyle, wrapLongLines }: Props) {
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const check = () => setIsDark(document.documentElement.getAttribute('data-theme') !== 'light')
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  return (
    <SyntaxHighlighter
      language={language}
      style={isDark ? atomOneDark : atomOneLight}
      customStyle={customStyle}
      wrapLongLines={wrapLongLines}
      // quebra também strings sem espaço (tokens, URLs, base64)
      codeTagProps={wrapLongLines ? { style: { overflowWrap: 'anywhere' } } : undefined}
    >
      {children}
    </SyntaxHighlighter>
  )
}
