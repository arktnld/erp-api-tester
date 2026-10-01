import type { CSSProperties } from 'react'

const skel = (w: string | number, h: number, r = 6, delay = 0): CSSProperties => ({
  width: w,
  height: h,
  borderRadius: r,
  backgroundColor: 'var(--surface-2)',
  animation: `pulse 1.5s ease-in-out ${delay}s infinite`,
  flexShrink: 0,
})

export default function TestLoading() {
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* URL bar skeleton */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={skel(44, 22, 4)} />
        <div style={skel('55%', 14, 4)} />
        <div style={{ flex: 1 }} />
        <div style={skel(70, 28, 6)} />
        <div style={skel(130, 28, 6)} />
      </div>

      {/* 3 panels */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: selectors (260px) */}
        <div style={{ width: 260, minWidth: 260, borderRight: '1px solid var(--border)', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
          {[0, 0.1, 0.2, 0.3].map((delay, i) => (
            <div key={i}>
              <div style={{ ...skel(90, 9, 3, delay), marginBottom: 6 }} />
              <div style={skel('100%', 34, 6, delay)} />
            </div>
          ))}
        </div>

        {/* Middle: request (flex 1) */}
        <div style={{ flex: 1, borderRight: '1px solid var(--border)', padding: 16, display: 'flex', flexDirection: 'column', gap: 20, overflow: 'auto' }}>
          <div>
            <div style={{ ...skel(55, 9, 3), marginBottom: 10 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[0, 0.05, 0.1].map((delay, i) => (
                <div key={i} style={{ display: 'flex', gap: 12 }}>
                  <div style={skel('35%', 11, 3, delay)} />
                  <div style={skel('55%', 11, 3, delay)} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={skel(40, 9, 3)} />
              <div style={skel(80, 26, 5)} />
            </div>
            <div style={skel('100%', 180, 8, 0.1)} />
          </div>
        </div>

        {/* Right: response (flex 1) */}
        <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={skel('45%', 9, 3)} />
          <div style={skel('100%', 320, 8, 0.15)} />
        </div>
      </div>

      <style>{`@keyframes pulse { 0%, 100% { opacity: 0.4 } 50% { opacity: 1 } }`}</style>
    </div>
  )
}
