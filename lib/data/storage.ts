// lib/data/storage.ts — upload de imagem para o bucket 'produtos' usando a SESSÃO
// do usuário logado (política RLS 'produtos authenticated write'). Não depende do
// service_role — funciona só com as chaves públicas + sessão.
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function uploadImagem(file: File, prefix = ''): Promise<string> {
  const supabase = await createServerClient()
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${prefix}${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from('produtos')
    .upload(path, file, { upsert: false, contentType: file.type || undefined })
  if (error) throw new Error('Falha ao subir a imagem: ' + error.message)
  const { data } = supabase.storage.from('produtos').getPublicUrl(path)
  return data.publicUrl
}
