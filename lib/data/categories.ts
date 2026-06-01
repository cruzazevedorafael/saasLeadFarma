// lib/data/categories.ts
import { createAdminClient } from '@/lib/supabase/admin'

export interface Category {
  id: string
  name: string
  sortOrder: number
}

function map(r: any): Category {
  return { id: r.id, name: r.name, sortOrder: Number(r.sort_order ?? 0) }
}

export async function getCategories(): Promise<Category[]> {
  const db = createAdminClient()
  const { data, error } = await db
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map(map)
}
