// Botão flutuante "Ver catálogo" no painel (só aparece p/ farmácia com slug).
import { getSessionProfile } from '@/lib/auth/session'
import { getPharmacyById } from '@/lib/data/pharmacy'
import { AppSwitch } from '@/components/app-switch'

export async function VerCatalogo() {
  const session = await getSessionProfile()
  if (!session?.pharmacyId) return null
  const ph = await getPharmacyById(session.pharmacyId)
  if (!ph?.slug) return null
  return <AppSwitch href={`/f/${ph.slug}`} variant="catalogo" />
}
