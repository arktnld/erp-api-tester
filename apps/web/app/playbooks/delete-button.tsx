'use client'

import { useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deletePlaybook } from '@/lib/actions/playbooks'
import { useRole } from '@/lib/role-context'

export function DeleteButton({ id }: { id: number }) {
  const [, startTransition] = useTransition()
  const { canAdmin: canEdit } = useRole()
  if (!canEdit) return null
  return (
    <Button variant="ghost" size="sm" onClick={() => startTransition(() => deletePlaybook(id))}>
      <Trash2 size={13} />
    </Button>
  )
}
