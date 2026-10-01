// Gitea labels: methods are "basic" (outlined), statuses are tinted fills.
const badgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 7px',
  borderRadius: 'var(--radius)',
  fontSize: 11,
  lineHeight: '18px',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontWeight: 700,
  border: '1px solid transparent',
}

const methodVars: Record<string, string> = {
  GET: '--method-get',
  POST: '--method-post',
  PUT: '--method-put',
  PATCH: '--method-patch',
  DELETE: '--method-delete',
}

export function MethodBadge({ method }: { method: string }) {
  const v = methodVars[method] ?? '--text-muted'
  return (
    <span
      style={{
        ...badgeStyle,
        color: `var(${v})`,
        borderColor: `var(${v})`,
      }}
    >
      {method}
    </span>
  )
}

export function StatusBadge({ code }: { code: number }) {
  const v =
    code >= 500 ? '--status-error'
    : code >= 400 ? '--status-warning'
    : code >= 300 ? '--status-warning'
    : code >= 200 ? '--status-success'
    : code >= 100 ? '--accent'
    : '--text-muted'
  // 5xx=red, 4xx=amber, 3xx=amber, 2xx=green, 1xx=blue
  return (
    <span
      style={{
        ...badgeStyle,
        color: `var(${v})`,
        backgroundColor: `color-mix(in srgb, var(${v}) 16%, transparent)`,
      }}
    >
      {code || '—'}
    </span>
  )
}
