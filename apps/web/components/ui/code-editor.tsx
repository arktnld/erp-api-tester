'use client'

import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { xml } from '@codemirror/lang-xml'
import { oneDark } from '@codemirror/theme-one-dark'

export type EditorLanguage = 'json' | 'xml' | 'text'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  language?: EditorLanguage
  minHeight?: number
  /** Ocupa toda a altura do contêiner flex (sem cantos arredondados). */
  fill?: boolean
}

function getExtensions(language: EditorLanguage) {
  if (language === 'json') return [json(), EditorView.lineWrapping]
  if (language === 'xml') return [xml(), EditorView.lineWrapping]
  return [EditorView.lineWrapping]
}

export function CodeEditor({ value, onChange, onBlur, language = 'json', minHeight = 180, fill = false }: CodeEditorProps) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      extensions={getExtensions(language)}
      theme={oneDark}
      height={fill ? '100%' : undefined}
      style={fill
        ? { flex: 1, minHeight: 0, overflow: 'hidden', fontSize: 12 }
        : { minHeight, borderRadius: 8, overflow: 'hidden', fontSize: 12 }}
    />
  )
}
