// app/_actions/buscar-cliente.ts
// Autofill do checkout: dado o CPF (já cadastrado NAQUELA farmácia), devolve o
// último cadastro para preencher o formulário. Chamado do catálogo (anônimo),
// por isso passa pelo service_role e é preso à farmácia do catálogo.
//
// NOTA DE PRIVACIDADE: isto expõe o cadastro por CPF. Mitigações: escopo por
// farmácia + exige CPF válido (dígitos verificadores). Para farmácia pequena é
// aceitável; se virar SaaS público em escala, proteger com verificação extra.
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidCpf, onlyDigits } from '@/lib/cpf'

export interface ClienteAutofill {
  name: string
  phone: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  lgpdConsent: boolean
}

export async function buscarClientePorCpf(
  pharmacyId: string,
  cpf: string,
): Promise<ClienteAutofill | null> {
  const digits = onlyDigits(cpf)
  if (!pharmacyId || !isValidCpf(digits)) return null
  try {
    const db = createAdminClient()
    const { data } = await db
      .from('customers')
      .select('name, phone, cep, logradouro, numero, complemento, bairro, cidade, uf, lgpd_consent')
      .eq('pharmacy_id', pharmacyId)
      .eq('cpf', digits)
      .single()
    if (!data) return null
    return {
      name: data.name ?? '', phone: data.phone ?? '',
      cep: data.cep ?? '', logradouro: data.logradouro ?? '', numero: data.numero ?? '',
      complemento: data.complemento ?? '', bairro: data.bairro ?? '', cidade: data.cidade ?? '', uf: data.uf ?? '',
      lgpdConsent: data.lgpd_consent ?? false,
    }
  } catch {
    return null
  }
}
