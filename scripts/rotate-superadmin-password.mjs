// scripts/rotate-superadmin-password.mjs
// Gera uma senha forte nova pro superadmin da plataforma e atualiza via
// Supabase Auth Admin API. A senha só aparece UMA VEZ no terminal — salve
// num gerenciador de senhas assim que rodar.
// Uso: node scripts/rotate-superadmin-password.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { randomBytes } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const env = {}
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2]
}
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL = 'leadfarma.br@gmail.com'
if (!SUPA_URL || !SERVICE) { console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em .env.local'); process.exit(1) }

function novaSenha() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
  const bytes = randomBytes(20)
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('')
}

async function main() {
  // Nota: sem paginação — ok pro número de usuários que a plataforma tem hoje.
  const listRes = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
    headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE },
  })
  const listJson = await listRes.json()
  const user = (listJson.users ?? []).find((u) => u.email === EMAIL)
  if (!user) { console.error(`Usuário ${EMAIL} não encontrado`); process.exit(1) }

  const senha = novaSenha()
  const upRes = await fetch(`${SUPA_URL}/auth/v1/admin/users/${user.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: senha }),
  })
  if (!upRes.ok) { console.error('Falha ao atualizar senha:', await upRes.text()); process.exit(1) }

  console.log(`✅ Senha do superadmin (${EMAIL}) trocada.`)
  console.log(`Nova senha (salve agora, não será mostrada de novo): ${senha}`)
}

main()
