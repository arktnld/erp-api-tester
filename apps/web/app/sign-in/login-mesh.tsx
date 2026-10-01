'use client'

import { useEffect, useRef } from 'react'

const N = 90
const MAX_DIST = 160
const FILL_DIST = MAX_DIST * 0.75

type Pt = { x: number; y: number; vx: number; vy: number; r: number }

function spawn(w: number, h: number): Pt {
  const speed = 0.25 + Math.random() * 0.35
  const angle = Math.random() * Math.PI * 2
  return {
    x: Math.random() * w, y: Math.random() * h,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    r: 1.2 + Math.random() * 1.4,
  }
}

export function LoginMesh() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let alive = true
    let raf: number

    function resize() {
      canvas!.width = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const pts = Array.from({ length: N }, () => spawn(canvas.width, canvas.height))

    function loop() {
      if (!alive || !ctx || !canvas) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of pts) {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
      }

      const adj: number[][] = pts.map(() => [])
      const dist: number[][] = []
      for (let i = 0; i < pts.length; i++) {
        dist[i] = []
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          dist[i][j] = d
          if (d < MAX_DIST) { adj[i].push(j); adj[j].push(i) }
        }
      }

      // Triangles
      for (let i = 0; i < pts.length; i++) {
        for (const j of adj[i]) {
          if (j <= i) continue
          const dij = dist[i][j]
          if (dij > FILL_DIST) continue
          for (const k of adj[j]) {
            if (k <= j || !adj[i].includes(k)) continue
            const dik = dist[i]?.[k] ?? dist[k]?.[i]
            const djk = dist[j]?.[k] ?? dist[k]?.[j]
            if (dik > FILL_DIST || djk > FILL_DIST) continue
            if ((i * 31 + j * 17 + k * 7) % 3 !== 0) continue
            const avgDist = (dij + dik + djk) / 3
            const a = (1 - avgDist / FILL_DIST) * 0.18
            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y)
            ctx.lineTo(pts[j].x, pts[j].y)
            ctx.lineTo(pts[k].x, pts[k].y)
            ctx.closePath()
            ctx.fillStyle = `rgba(99,102,241,${a})`
            ctx.fill()
          }
        }
      }

      // Lines
      for (let i = 0; i < pts.length; i++) {
        for (const j of adj[i]) {
          if (j <= i) continue
          const d = dist[i][j]
          ctx.beginPath()
          ctx.moveTo(pts[i].x, pts[i].y)
          ctx.lineTo(pts[j].x, pts[j].y)
          ctx.strokeStyle = `rgba(99,102,241,${(1 - d / MAX_DIST) * 0.35})`
          ctx.lineWidth = 0.7
          ctx.stroke()
        }
      }

      // Dots
      for (const p of pts) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(129,140,248,0.85)'
        ctx.fill()
      }

      raf = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
    />
  )
}
