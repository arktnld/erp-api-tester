'use client'

import { useState } from 'react'
import { AlertCircle, ArrowBigUp, Eye, EyeOff, Loader2 } from 'lucide-react'
import { LoginParticles } from './login-particles'
import { LoginMesh } from './login-mesh'
import logoDark from '@/assets/brand/logo-dark.png'

// Structure ported from Gitea's sign-in (templates/user/auth/signin_inner.tmpl):
// alert above, attached header, labelled fields, "forgot password" beside the label,
// remember-me, full-width primary button. Plus: show-password and Caps Lock warning.
// The login screen is always dark (animated background), so it uses Gitea's dark palette directly.
const C = {
  header: '#1b1c1e', body: '#161718', border: '#3f4248', inputBg: '#1e1f20', inputBorder: '#4a4d53',
  text: '#d2d4d8', strong: '#e6e8eb', muted: '#9ea2a8', primary: '#4183c4', primaryHover: '#548fca', link: '#6ea3d9',
  errorBg: '#3a1f22', errorBorder: '#6b2d31', errorText: '#f2a7a7', warn: '#e3b341',
}

const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: C.strong }
const input: React.CSSProperties = {
  width: '100%', height: 36, padding: '0 12px', fontSize: 14, color: C.strong,
  background: C.inputBg, border: `1px solid ${C.inputBorder}`, borderRadius: 4,
}
const required = <span aria-hidden style={{ color: '#db2828', marginLeft: 3 }}>*</span>

export function SignInClient({ next }: { next: string }) {
  const [variant] = useState(() => Math.random() < 0.5 ? 'particles' : 'mesh')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setPending(true); setError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password'), remember: form.get('remember') === 'on', next }),
      })
      const data = await res.json().catch(() => ({})) as { redirect?: string; error?: string }
      if (res.ok && data.redirect) { window.location.assign(data.redirect); return }
      setError(data.error ?? 'Não foi possível entrar. Tente de novo.')
    } catch {
      setError('Sem conexão com o servidor.')
    }
    setPending(false)
  }

  const trackCapsLock = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'))

  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#070712', gap: 24, padding: '32px 16px', position: 'relative',
      }}
    >
      {variant === 'particles' ? <LoginParticles /> : <LoginMesh />}
      <style>{`
        .login-input:focus { outline: none; border-color: ${C.primary} !important; box-shadow: 0 0 0 3px rgba(65,131,196,.25); }
        .login-submit:hover:not(:disabled) { background: ${C.primaryHover} !important; }
        .login-link { color: ${C.link}; background: none; border: none; padding: 0; font-size: 13px; cursor: pointer; }
        .login-link:hover { text-decoration: underline; }
        @keyframes login-spin { to { transform: rotate(360deg) } }
      `}</style>

      {/* eslint-disable-next-line @next/next/no-img-element -- login background is always dark */}
      <img src={logoDark.src} alt="ERP Tester" width={180} height={60} className="brand-logo" style={{ position: 'relative', zIndex: 10 }} />

      <div style={{ position: 'relative', zIndex: 10, width: 400, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 14, color: C.errorText, background: C.errorBg, border: `1px solid ${C.errorBorder}`, borderRadius: 6 }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
          </div>
        )}

        <div style={{ border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.45)' }}>
          <h1 style={{ margin: 0, padding: '11px 16px', textAlign: 'center', fontSize: 16, fontWeight: 600, color: C.strong, background: C.header, borderBottom: `1px solid ${C.border}` }}>
            Acesse sua conta
          </h1>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20, background: C.body }}>
            <div>
              <label htmlFor="email" style={{ ...label, display: 'block', marginBottom: 6 }}>E-mail{required}</label>
              <input id="email" name="email" type="email" autoComplete="username" required autoFocus className="login-input" style={input} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 6 }}>
                <label htmlFor="password" style={{ ...label, flex: 1 }}>Senha{required}</label>
                <button type="button" className="login-link" aria-expanded={forgotOpen} onClick={() => setForgotOpen((v) => !v)}>
                  Esqueceu a senha?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required
                  className="login-input" style={{ ...input, paddingRight: 40 }}
                  onKeyUp={trackCapsLock} onKeyDown={trackCapsLock} onBlur={() => setCapsLock(false)}
                />
                <button
                  type="button" onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword} title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  style={{ position: 'absolute', right: 4, top: 4, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', borderRadius: 4, color: C.muted, cursor: 'pointer' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {capsLock && (
                <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontSize: 12, color: C.warn }}>
                  <ArrowBigUp size={14} /> Caps Lock está ligado
                </div>
              )}
              {forgotOpen && (
                <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.5, color: C.muted }}>
                  Peça a um administrador para gerar uma senha nova em Configurações → Usuários.
                </div>
              )}
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: C.text, cursor: 'pointer', width: 'fit-content' }}>
              <input type="checkbox" name="remember" defaultChecked style={{ width: 15, height: 15, accentColor: C.primary }} />
              Lembrar-me
            </label>

            <button
              type="submit" disabled={pending} className="login-submit"
              style={{
                height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 14, fontWeight: 600, color: '#fff', background: C.primary, border: 'none', borderRadius: 4,
                cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.8 : 1,
              }}
            >
              {pending && <Loader2 size={16} style={{ animation: 'login-spin 1s linear infinite' }} />}
              {pending ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>

      <p style={{ fontSize: 11, color: '#555', position: 'relative', zIndex: 10, margin: 0 }}>ERP Tester</p>
    </div>
  )
}
