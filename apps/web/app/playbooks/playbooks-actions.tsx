'use client'

import Link from 'next/link'
import { Plus, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRole } from '@/lib/role-context'
import { DeleteButton } from './delete-button'

export function NewPlaybookButton() {
  const { canAdmin: canEdit } = useRole()
  if (!canEdit) return null
  return (
    <Link href="/playbooks/new">
      <Button><Plus size={14} /> Novo Playbook</Button>
    </Link>
  )
}

export function CreatePlaybookLink() {
  const { canAdmin: canEdit } = useRole()
  if (!canEdit) return null
  return (
    <Link href="/playbooks/new" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Criar agora</Link>
  )
}

export function PlaybookEditActions({ id }: { id: number }) {
  const { canAdmin: canEdit } = useRole()
  if (!canEdit) return null
  return (
    <>
      <Link href={`/playbooks/${id}/edit`}>
        <Button variant="ghost" size="sm"><Pencil size={13} /></Button>
      </Link>
      <DeleteButton id={id} />
    </>
  )
}
