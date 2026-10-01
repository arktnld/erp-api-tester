/** Initials from a name (or e-mail when there's no name): "Ana Souza" → "AS". */
export function initials(nameOrEmail: string): string {
  return nameOrEmail.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?'
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, flexShrink: 0, borderRadius: '50%',
        background: 'var(--accent-soft)', color: 'var(--link)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: Math.round(size * 0.4), fontWeight: 700,
      }}
    >
      {initials(name)}
    </span>
  )
}
