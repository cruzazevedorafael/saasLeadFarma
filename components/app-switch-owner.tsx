'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AppSwitch } from './app-switch'

// Mostra o botão flutuante "Ir ao meu painel" SÓ para a dona da farmácia logada.
// A checagem é feita no NAVEGADOR (não no servidor) de propósito: assim a página do
// catálogo não precisa ler cookies no render e pode ser estática/ISR (rápida + CDN).
// Para o visitante comum (99% dos acessos) isso não renderiza nada.
export function AppSwitchOwner({ pharmacyId }: { pharmacyId: string }) {
  const [isDona, setIsDona] = useState(false)

  useEffect(() => {
    let ativo = true
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !ativo) return
      const { data } = await supabase
        .from('profiles')
        .select('pharmacy_id')
        .eq('id', user.id)
        .single()
      if (ativo && data?.pharmacy_id === pharmacyId) setIsDona(true)
    })()
    return () => {
      ativo = false
    }
  }, [pharmacyId])

  if (!isDona) return null
  return <AppSwitch href="/painel" variant="painel" />
}
