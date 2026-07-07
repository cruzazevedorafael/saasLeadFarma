'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { alternarStatus } from '../actions'
import { Button } from '@/components/ui/button'

export function StatusToggle({ id, status }: { id: string; status: 'active' | 'suspended' }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const next = status === 'active' ? 'suspended' : 'active'
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => { setBusy(true); await alternarStatus(id, next); setBusy(false); router.refresh() }}
    >
      {status === 'active' ? 'Suspender' : 'Reativar'}
    </Button>
  )
}
