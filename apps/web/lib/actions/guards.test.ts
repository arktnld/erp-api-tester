import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// Server actions are POST endpoints anyone can call by id, so every exported
// action must check the session itself. This fails when a new one forgets.
const ROOT = join(__dirname, '..', '..')
const GUARD = /await require(User|Edit|Admin)\(\)|await requireOtherUser\(|await canSeeSecrets\(\)/
// logout ends the caller's own session (nothing to protect without one).
const ALLOWED = new Set(['app/sign-in/actions.ts:logout'])

function serverActionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (name === 'node_modules' || name.startsWith('.')) return []
    if (statSync(p).isDirectory()) return serverActionFiles(p)
    return /\.tsx?$/.test(name) && !name.includes('.test.') && readFileSync(p, 'utf8').startsWith("'use server'") ? [p] : []
  })
}

describe('server actions', () => {
  const files = [...serverActionFiles(join(ROOT, 'app')), ...serverActionFiles(join(ROOT, 'lib'))]

  it('finds the action files', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it('all check the session or role before doing anything', () => {
    const missing: string[] = []
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      for (const m of src.matchAll(/export async function (\w+)/g)) {
        const next = src.indexOf('\nexport ', m.index! + 1)
        const body = src.slice(m.index!, next === -1 ? undefined : next)
        const id = `${relative(ROOT, file)}:${m[1]}`
        if (!GUARD.test(body) && !ALLOWED.has(id)) missing.push(id)
      }
    }
    expect(missing).toEqual([])
  })
})
