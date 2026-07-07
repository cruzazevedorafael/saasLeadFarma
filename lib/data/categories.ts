// lib/data/categories.ts
import { createClient as createServerClient } from '@/lib/supabase/server'

export interface Category {
  id: string
  name: string
  sortOrder: number
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function map(r: any): Category {
  return { id: r.id, name: r.name, sortOrder: Number(r.sort_order ?? 0) }
}

// PAINEL: client autenticado → RLS isola pela farmácia do usuário.
export async function getCategories(): Promise<Category[]> {
  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(map)
}
