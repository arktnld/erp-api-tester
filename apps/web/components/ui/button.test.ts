import { buttonVariants } from './button'

test('default variant contains btn-default', () => {
  expect(buttonVariants({})).toContain('btn-default')
})

test('ghost variant contains btn-ghost', () => {
  expect(buttonVariants({ variant: 'ghost' })).toContain('btn-ghost')
})

test('danger variant contains btn-danger', () => {
  expect(buttonVariants({ variant: 'danger' })).toContain('btn-danger')
})

test('sm size contains btn-sm', () => {
  expect(buttonVariants({ size: 'sm' })).toContain('btn-sm')
})

test('icon size contains btn-icon', () => {
  expect(buttonVariants({ size: 'icon' })).toContain('btn-icon')
})
