// app/painel/pedidos/page.tsx
import Link from 'next/link'
import { BackButton } from '@/components/ui/back-button'
import { requirePharmacyAdmin, getCurrentPharmacy } from '@/lib/auth/guards'
import { getAdminOrders } from '@/lib/data/orders'
import type { OrderStatus } from '@/lib/data/orders.types'
import { PedidosList } from './_components/pedidos-list'

const FILTROS: { key: string; label: string; status?: OrderStatus }[] = [
  { key: 'pending', label: 'Pendentes', status: 'pending' },
  { key: 'completed', label: 'Baixados', status: 'completed' },
  { key: 'cancelled', label: 'Cancelados', status: 'cancelled' },
  { key: 'all', label: 'Todos' },
]

export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requirePharmacyAdmin()
  const pharmacy = await getCurrentPharmacy()

  const { f = 'pending' } = await searchParams
  const filtro = FILTROS.find((x) => x.key === f) ?? FILTROS[0]
  const pedidos = await getAdminOrders(pharmacy.id, filtro.status)

  return (
    <div className="container mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <BackButton href="/painel" label="Painel" />
          <h1 className="text-2xl font-bold">Pedidos</h1>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTROS.map((x) => (
          <Link
            key={x.key}
            href={`/painel/pedidos?f=${x.key}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium ${
              x.key === filtro.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {x.label}
          </Link>
        ))}
      </div>

      <PedidosList
        key={filtro.key}
        initialPedidos={pedidos}
        pharmacy={pharmacy}
        statusFiltro={filtro.status}
      />
    </div>
  )
}
