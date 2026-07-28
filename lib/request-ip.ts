// IP do cliente numa Server Action — a Vercel injeta x-forwarded-for.
import { headers } from 'next/headers'

export async function getClientIp(): Promise<string> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return h.get('x-real-ip') ?? 'unknown'
}
