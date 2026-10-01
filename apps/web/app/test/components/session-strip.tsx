'use client'

const METHOD_COLORS: Record<string, string> = {
  GET: 'var(--method-get)',
  POST: 'var(--method-post)',
  PUT: 'var(--method-put)',
  PATCH: 'var(--method-patch)',
  DELETE: 'var(--method-delete)',
}

function statusColor(code: number | null): string {
  if (!code) return 'var(--text-subtle)'
  if (code >= 200 && code < 300) return 'var(--status-success)'
  if (code >= 400) return 'var(--status-error)'
  return 'var(--status-warning)'
}

export type SessionInfo = {
  id: string
  endpointName: string | null
  endpointMethod: string | null
  statusCode: number | null
  durationMs: number | null
  isActive: boolean
  isLoading: boolean
}

interface SessionStripProps {
  sessions: SessionInfo[]
  onSwitch: (id: string) => void
  onCreate: () => void
  onClose: (id: string) => void
}

export function SessionStrip({ sessions, onSwitch, onCreate, onClose }: SessionStripProps) {
  return (
    <>
      <style>{`
        .session-strip {
          width: 52px;
          border-left: 1px solid var(--border);
          background: var(--surface);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 10px 0;
          gap: 3px;
          overflow: hidden;
          flex-shrink: 0;
          transition: width 280ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        .session-strip:hover {
          width: 200px;
        }
        .session-btn-label {
          opacity: 0;
          transition: opacity 180ms ease 120ms;
          white-space: nowrap;
          overflow: hidden;
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .session-strip:hover .session-btn-label {
          opacity: 1;
        }
        .session-close {
          opacity: 0;
          transition: opacity 100ms ease;
          flex-shrink: 0;
        }
        .session-strip:hover .session-close {
          opacity: 1;
        }
        .session-add-label {
          opacity: 0;
          transition: opacity 180ms ease 120ms;
          white-space: nowrap;
          color: var(--text-subtle);
          font-size: 11px;
        }
        .session-strip:hover .session-add-label {
          opacity: 1;
        }
      `}</style>

      <div className="session-strip">
        {sessions.map((s) => {
          const methodColor = s.endpointMethod ? (METHOD_COLORS[s.endpointMethod] ?? 'var(--text-subtle)') : 'var(--text-subtle)'
          const sColor = statusColor(s.statusCode)
          const isActive = s.isActive

          return (
            <div
              key={s.id}
              onClick={() => onSwitch(s.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 8px',
                width: 200,
                height: 44,
                cursor: 'pointer',
                flexShrink: 0,
                borderLeft: `2px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                backgroundColor: isActive ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                transition: 'background 0.1s',
              }}
            >
              {/* icon */}
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                border: `1px solid ${isActive ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--border)'}`,
                backgroundColor: isActive ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'var(--surface-2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                flexShrink: 0,
                transition: 'border-color 0.1s, background 0.1s',
              }}>
                {s.isLoading ? (
                  <span style={{ width: 10, height: 10, border: '1.5px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'block' }} />
                ) : (
                  <>
                    <span style={{ fontSize: 8, fontWeight: 700, color: s.endpointMethod ? methodColor : 'var(--text-subtle)', lineHeight: 1, fontFamily: 'monospace' }}>
                      {s.endpointMethod ?? '—'}
                    </span>
                    {s.statusCode && (
                      <span style={{ fontSize: 8, fontWeight: 600, color: sColor, lineHeight: 1, fontFamily: 'monospace' }}>
                        {s.statusCode}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* label */}
              <div className="session-btn-label">
                <span style={{
                  fontSize: 11,
                  color: isActive ? 'var(--text)' : 'var(--text-muted)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 120,
                  fontWeight: isActive ? 500 : 400,
                }}>
                  {s.endpointName ?? 'Nova sessão'}
                </span>
                {s.statusCode && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 9, color: sColor, fontFamily: 'monospace', fontWeight: 600 }}>{s.statusCode}</span>
                    {s.durationMs && (
                      <span style={{ fontSize: 9, color: 'var(--text-subtle)' }}>{s.durationMs}ms</span>
                    )}
                  </div>
                )}
              </div>

              {/* close — only show when there's more than 1 session */}
              {sessions.length > 1 && (
                <button
                  className="session-close"
                  onClick={(e) => { e.stopPropagation(); onClose(s.id) }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-subtle)',
                    padding: '2px 4px',
                    borderRadius: 3,
                    lineHeight: 1,
                    fontSize: 12,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          )
        })}

        {/* add button */}
        <button
          onClick={onCreate}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 8px',
            width: 200,
            height: 36,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
            marginTop: 4,
          }}
        >
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            border: '1px dashed var(--border-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-subtle)',
            fontSize: 16,
            flexShrink: 0,
          }}>
            +
          </div>
          <span className="session-add-label">Nova sessão</span>
        </button>
      </div>
    </>
  )
}
