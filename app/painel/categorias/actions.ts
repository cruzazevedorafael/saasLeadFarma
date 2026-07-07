// app/painel/categorias/actions.ts
'use server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPharmacyId } from '@/lib/auth/guards'
import { revalidatePath } from 'next/cache'

export async function createCategoria(name: string) {
  const pharmacyId = await getCurrentPharmacyId()
  const nome = name.trim()
  if (!nome) throw new Error('Nome obrigatório')
  const db = createAdminClient()
  const { error } = await db.from('categories').insert({ pharmacy_id: pharmacyId, name: nome })
  if (error) throw new Error('Não foi possível criar (nome duplicado?).')
  revalidatePath('/painel/categorias')
  revalidatePath('/')
}

export async function renameCategoria(id: string, oldName: string, newName: string) {
  const pharmacyId = await getCurrentPharmacyId()
  const nome = newName.trim()
  if (!nome) throw new Error('Nome obrigatório')
  const db = createAdminClient()
  const { error } = await db.from('categories').update({ name: nome, updated_at: new Date().toISOString() }).eq('id', id).eq('pharmacy_id', pharmacyId)
  if (error) throw new Error('Não foi possível renomear (nome duplicado?).')
  // propaga o novo nome para os produtos que usavam o nome antigo
  await db.from('products').update({ category: nome, updated_at: new Date().toISOString() }).eq('category', oldName).eq('pharmacy_id', pharmacyId)
  revalidatePath('/painel/categorias')
  revalidatePath('/painel/produtos')
  revalidatePath('/')
}

export async function deleteCategoria(id: string, name: string) {
  const pharmacyId = await getCurrentPharmacyId()
  const db = createAdminClient()
  const { count, error: cErr } = await db
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('category', name)
    .eq('pharmacy_id', pharmacyId)
  if (cErr) throw cErr
  if ((count ?? 0) > 0) {
    throw new Error(`${count} produto(s) usam "${name}". Mova-os antes de apagar.`)
  }
  const { error } = await db.from('categories').delete().eq('id', id).eq('pharmacy_id', pharmacyId)
  if (error) throw error
  revalidatePath('/painel/categorias')
  revalidatePath('/')
}
