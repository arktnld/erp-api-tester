import { canEdit, canAdmin, getRoleLabel, getRole, ROLES } from './roles'

test('admin can edit', () => {
  expect(canEdit('admin')).toBe(true)
})

test('editor can edit', () => {
  expect(canEdit('editor')).toBe(true)
})

test('viewer cannot edit', () => {
  expect(canEdit('viewer')).toBe(false)
})

test('undefined cannot edit', () => {
  expect(canEdit(undefined)).toBe(false)
})

test('only admin can admin', () => {
  expect(canAdmin('admin')).toBe(true)
  expect(canAdmin('editor')).toBe(false)
  expect(canAdmin('viewer')).toBe(false)
})

test('getRole defaults to viewer when no metadata', () => {
  expect(getRole(undefined)).toBe('viewer')
  expect(getRole(null)).toBe('viewer')
  expect(getRole({})).toBe('viewer')
  expect(getRole({ role: 'unknown' })).toBe('viewer')
})

test('getRole returns correct role from metadata', () => {
  expect(getRole({ role: 'admin' })).toBe('admin')
  expect(getRole({ role: 'editor' })).toBe('editor')
  expect(getRole({ role: 'viewer' })).toBe('viewer')
})

test('getRoleLabel returns correct labels', () => {
  expect(getRoleLabel('admin')).toBe('Admin')
  expect(getRoleLabel('editor')).toBe('Editor')
  expect(getRoleLabel('viewer')).toBe('Viewer')
  expect(getRoleLabel(undefined)).toBe('Sem acesso')
})
