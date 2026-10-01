'use client'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, backgroundColor: '#0f1117', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '40px' }}>
          <p style={{ fontSize: 32, margin: 0 }}>⚠</p>
          <p style={{ fontSize: 15, fontWeight: 500, color: '#e2e8f0', margin: 0 }}>Algo deu errado</p>
          <p style={{ fontSize: 12, color: '#94a3b8', maxWidth: 400, textAlign: 'center', margin: 0 }}>{error.message}</p>
          <button
            onClick={reset}
            style={{ padding: '6px 16px', fontSize: 13, backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', marginTop: 4 }}
          >
            Tentar novamente
          </button>
        </div>
      </body>
    </html>
  )
}
