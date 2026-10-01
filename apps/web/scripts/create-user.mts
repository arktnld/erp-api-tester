// Creates (or resets the password of) a user from the server shell, e.g. the first admin.
// Usage, from apps/web:
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file=.env scripts/create-user.mts email@empresa.com "Nome" admin
// Prints a random password once. Run it again for the same e-mail to reset it.
import { createRequire } from 'node:module'
import { generatePassword, hashPassword } from '../lib/password.ts'

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../../../packages/db/src/generated')

const [email, name = '', role = 'admin'] = process.argv.slice(2)
// Same rule as the login form (zod email): a domain with a dot, so the account can actually sign in.
if (!email || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email.trim()) || !['admin', 'editor', 'viewer'].includes(role)) {
  console.error('uso: node --env-file=.env scripts/create-user.mts <email com domínio, ex. voce@empresa.com> [nome] [admin|editor|viewer]')
  process.exit(1)
}

const prisma = new PrismaClient()
const password = generatePassword()
const passwordHash = await hashPassword(password)
const normalized = email.trim().toLowerCase()
const user = await prisma.user.upsert({
  where: { email: normalized },
  create: { email: normalized, name, role, passwordHash },
  update: { passwordHash, role, failedLogins: 0, lockedUntil: null, ...(name ? { name } : {}) },
})
await prisma.session.deleteMany({ where: { userId: user.id } })
await prisma.$disconnect()
console.log(`${user.email} (${user.role}) — senha: ${password}`)
console.log('Troque em Configurações → Minha conta depois de entrar.')
