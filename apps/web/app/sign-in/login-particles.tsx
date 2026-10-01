'use client'

import { useEffect, useRef } from 'react'

const SNIPPETS = [
  'GET /api/v2/erp/clientes',
  '200 OK',
  'Authorization: Bearer',
  'Content-Type: application/json',
  '{ "status": "active" }',
  'POST /erp/notas-fiscais',
  '401 Unauthorized',
  'X-Request-ID: a3f9',
  'curl -X GET',
  '{ "total": 1482 }',
  'Bearer eyJhbGci...',
  'DELETE /api/erp/',
  '500 Internal Server',
  'PUT /clientes/id',
  '{ "cnpj": "00.',
  'PATCH /erp/config',
  '304 Not Modified',
]

const CSS = `
  @keyframes lp-blob1 {
    0%,100% { transform: translate(0,0) scale(1); }
    33%      { transform: translate(8vw,12vh) scale(1.1); }
    66%      { transform: translate(-5vw,8vh) scale(0.9); }
  }
  @keyframes lp-blob2 {
    0%,100% { transform: translate(0,0) scale(1); }
    33%      { transform: translate(-10vw,-8vh) scale(1.15); }
    66%      { transform: translate(6vw,-12vh) scale(0.85); }
  }
  @keyframes lp-blob3 {
    0%,100% { transform: translate(0,0) scale(1) rotate(0deg); }
    50%      { transform: translate(-15vw,10vh) scale(1.2) rotate(30deg); }
  }
  @keyframes lp-blob4 {
    0%,100% { transform: translate(0,0) scale(1); }
    40%      { transform: translate(-8vw,15vh) scale(0.9); }
    80%      { transform: translate(5vw,5vh) scale(1.1); }
  }
  @keyframes lp-fall {
    from { transform: translateY(-20px); opacity: 0; }
    5%   { opacity: 1; }
    95%  { opacity: 0.8; }
    to   { transform: translateY(110vh); opacity: 0; }
  }
`

export function LoginParticles() {
  const fragsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = fragsRef.current
    if (!container) return

    let alive = true
    const timers: ReturnType<typeof setTimeout>[] = []

    function spawn() {
      if (!alive || !container) return
      const el = document.createElement('div')
      el.textContent = SNIPPETS[Math.floor(Math.random() * SNIPPETS.length)]
      const dur = 12 + Math.random() * 20
      Object.assign(el.style, {
        position: 'absolute',
        fontFamily: 'monospace',
        fontSize: '11px',
        color: `rgba(99,102,241,${(0.08 + Math.random() * 0.12).toFixed(2)})`,
        whiteSpace: 'nowrap',
        left: Math.random() * 100 + 'vw',
        top: '-20px',
        animation: `lp-fall ${dur}s linear forwards`,
        animationDelay: '0s',
        pointerEvents: 'none',
      })
      container.appendChild(el)
      const t = setTimeout(() => el.remove(), (dur + 2) * 1000)
      timers.push(t)
    }

    // Initial batch with staggered delays
    for (let i = 0; i < 18; i++) {
      const t = setTimeout(spawn, Math.random() * 8000)
      timers.push(t)
    }
    const interval = setInterval(spawn, 1800)

    return () => {
      alive = false
      clearInterval(interval)
      timers.forEach(clearTimeout)
    }
  }, [])

  return (
    <>
      <style>{CSS}</style>

      {/* Mesh blobs */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', borderRadius: '50%', filter: 'blur(100px)',
          width: '70vw', height: '70vw', left: '-20vw', top: '-20vw',
          background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%)',
          animation: 'lp-blob1 20s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', borderRadius: '50%', filter: 'blur(100px)',
          width: '60vw', height: '60vw', right: '-15vw', bottom: '-10vw',
          background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)',
          animation: 'lp-blob2 25s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', borderRadius: '50%', filter: 'blur(100px)',
          width: '50vw', height: '50vw', left: '30vw', top: '20vh',
          background: 'radial-gradient(circle, rgba(79,70,229,0.15) 0%, transparent 70%)',
          animation: 'lp-blob3 18s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', borderRadius: '50%', filter: 'blur(100px)',
          width: '40vw', height: '40vw', right: '10vw', top: '-10vw',
          background: 'radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)',
          animation: 'lp-blob4 22s ease-in-out infinite',
        }} />
      </div>

      {/* Grid lines */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        backgroundImage: `
          linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)
        `,
        backgroundSize: '60px 60px',
      }} />

      {/* Grid intersection dots */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.12) 1px, transparent 1px)',
        backgroundSize: '60px 60px',
      }} />

      {/* Floating code fragments */}
      <div ref={fragsRef} style={{ position: 'fixed', inset: 0, zIndex: 2, pointerEvents: 'none', overflow: 'hidden' }} />
    </>
  )
}
