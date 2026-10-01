'use client'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '64px 40px' }}>
      <p style={{ fontSize: 32, margin: 0 }}>⚠</p>
      <p style={{ fontSize: 15, fontWeight: 500, margin: 0 }}>Algo deu errado</p>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 400, textAlign: 'center', margin: 0 }}>{error.message}</p>
      <button
        onClick={reset}
        style={{ padding: '6px 16px', fontSize: 13, backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', marginTop: 4 }}
      >
        Tentar novamente
      </button>
    </div>
  )
}
