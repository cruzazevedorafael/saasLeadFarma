// scripts/seed-fase0.mjs
// Aplica as migrations da Fase 0 no Supabase e cria super-admin + farmácia de teste.
// Idempotente. Lê segredos de .env.local (nunca versionados).
// Uso: node scripts/seed-fase0.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ---- carregar .env.local ----
const env = {}
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2]
}
const REF = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host.split('.')[0]
const PAT = env.SUPABASE_ACCESS_TOKEN
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL
if (!REF || !PAT || !SERVICE) { console.error('Faltam variáveis em .env.local'); process.exit(1) }

const TEST = {
  superEmail: 'leadfarma.br@gmail.com',
  superPass: 'Projetarcode321@',
  phSlug: 'farmacia-teste',
  phName: 'Farmácia Teste',
  phEmail: 'farmaciateste@leadfarma.br',
  phPass: 'FarmaciaTeste321@',
}

// ---- Management API: roda SQL como postgres (bypassa RLS) ----
async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  const text = await r.text()
  if (!r.ok) throw new Error(`SQL ${r.status}: ${text}`)
  return text ? JSON.parse(text) : []
}

// ---- Auth Admin: cria usuário (idempotente) e devolve o id ----
async function ensureUser(email, password) {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true }),
  })
  if (r.ok) { const u = await r.json(); return u.id }
  // já existe? busca o id em auth.users
  const rows = await sql(`select id from auth.users where email = '${email.replace(/'/g, "''")}' limit 1`)
  if (rows[0]?.id) return rows[0].id
  throw new Error(`Falha ao criar/achar usuário ${email}: ${await r.text()}`)
}

async function main() {
  console.log(`Projeto: ${REF}`)

  console.log('→ aplicando 0001_pharmacies_profiles.sql')
  await sql(readFileSync(join(ROOT, 'supabase/migrations/0001_pharmacies_profiles.sql'), 'utf8'))
  console.log('→ aplicando 0002_catalog_e_negocio_tenant.sql')
  await sql(readFileSync(join(ROOT, 'supabase/migrations/0002_catalog_e_negocio_tenant.sql'), 'utf8'))

  const tables = await sql(`select table_name from information_schema.tables where table_schema='public' order by table_name`)
  console.log('  tabelas:', tables.map((t) => t.table_name).join(', '))

  console.log('→ super-admin', TEST.superEmail)
  const superId = await ensureUser(TEST.superEmail, TEST.superPass)
  await sql(`insert into public.profiles (id, pharmacy_id, role) values ('${superId}', null, 'superadmin')
             on conflict (id) do update set role='superadmin', pharmacy_id=null`)

  console.log('→ farmácia de teste', TEST.phSlug)
  const ph = await sql(`insert into public.pharmacies (slug, nome_fantasia, nome_exibicao, status, onboarding_completed)
             values ('${TEST.phSlug}', '${TEST.phName}', '${TEST.phName}', 'active', false)
             on conflict (slug) do update set nome_fantasia=excluded.nome_fantasia
             returning id`)
  const phId = ph[0].id

  console.log('→ admin da farmácia', TEST.phEmail)
  const phAdminId = await ensureUser(TEST.phEmail, TEST.phPass)
  await sql(`insert into public.profiles (id, pharmacy_id, role) values ('${phAdminId}', '${phId}', 'pharmacy_admin')
             on conflict (id) do update set role='pharmacy_admin', pharmacy_id='${phId}'`)

  console.log('\n✅ Seed concluído')
  console.log(`   super-admin:   ${TEST.superEmail}  (id ${superId})`)
  console.log(`   farmácia:      ${TEST.phSlug}  (id ${phId})`)
  console.log(`   admin farmácia:${TEST.phEmail}  (id ${phAdminId})`)
}

main().catch((e) => { console.error('\n❌', e.message); process.exit(1) })
