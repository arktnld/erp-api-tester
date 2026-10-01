import type { CSSProperties } from 'react'

const skel = (w: string | number, h: number, r = 6, delay = 0): CSSProperties => ({
  width: w,
  height: h,
  borderRadius: r,
  backgroundColor: 'var(--surface-2)',
  animation: `pulse 1.5s ease-in-out ${delay}s infinite`,
  flexShrink: 0,
})

export default function HistoryLoading() {
  return (
    <div style={{ padding: '32px 40px' }}>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {([150, 170, 130, 110, 210] as const).map((w, i) => (
          <div key={i} style={skel(w, 34, 6, i * 0.05)} />
        ))}
      </div>

      {/* Table */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--surface)', display: 'flex', gap: 16, alignItems: 'center' }}>
          {([44, 36, '30%', '18%', 70, 60] as const).map((w, i) => (
            <div key={i} style={skel(w, 9, 3)} />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center' }}
          >
            {([44, 36, '30%', '18%', 70, 60] as const).map((w, j) => (
              <div key={j} style={skel(w, 12, 3, i * 0.07)} />
            ))}
          </div>
        ))}
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4 } 50% { opacity: 1 } }`}</style>
    </div>
  )
}
