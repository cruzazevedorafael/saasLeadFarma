// app/_actions/buscar-cliente.ts
// Autofill do checkout: dado o CPF + 2ª prova (últimos 4 dígitos do celular),
// devolve o cadastro daquela farmácia para preencher o formulário. Anônimo →
// service_role, preso à farmácia do catálogo.
//
// PRIVACIDADE: CPF isolado é público/vazado, e o pharmacyId está no HTML — então
// CPF sozinho permitiria enumerar endereço/telefone (doxxing). Exigimos uma 2ª
// prova: os últimos 4 dígitos do celular. Sem os dois, não devolve nada — e o
// retorno é idêntico (null) para "não achou" e "prova errada", pra não vazar
// existência do cadastro.
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
  phoneLast4: string,
): Promise<ClienteAutofill | null> {
  const digits = onlyDigits(cpf)
  const prova = onlyDigits(phoneLast4).slice(-4)
  // Exige CPF válido + 4 dígitos de 2ª prova.
  if (!pharmacyId || !isValidCpf(digits) || prova.length !== 4) return null
  try {
    const db = createAdminClient()
    const { data } = await db
      .from('customers')
      .select('name, phone, cep, logradouro, numero, complemento, bairro, cidade, uf, lgpd_consent')
      .eq('pharmacy_id', pharmacyId)
      .eq('cpf', digits)
      .single()
    if (!data) return null
    // 2ª prova: os últimos 4 dígitos do celular precisam bater. Mismatch → null (igual a "não achou").
    if (onlyDigits(data.phone ?? '').slice(-4) !== prova) return null
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
