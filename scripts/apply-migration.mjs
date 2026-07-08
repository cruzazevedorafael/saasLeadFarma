// scripts/apply-migration.mjs
// Aplica um ou mais arquivos .sql no Supabase via Management API (PAT).
// Idempotente depende do próprio SQL. Lê segredos de .env.local (nunca versionados).
// Uso: node scripts/apply-migration.mjs supabase/migrations/0003_produto_farmacia.sql [outro.sql ...]
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, isAbsolute } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const env = {}
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2]
}
const REF = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host.split('.')[0]
const PAT = env.SUPABASE_ACCESS_TOKEN
if (!REF || !PAT) { console.error('Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_ACCESS_TOKEN em .env.local'); process.exit(1) }

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

const files = process.argv.slice(2)
if (files.length === 0) { console.error('Informe ao menos um arquivo .sql'); process.exit(1) }

async function main() {
  console.log(`Projeto: ${REF}`)
  for (const f of files) {
    const path = isAbsolute(f) ? f : join(ROOT, f)
    console.log(`→ aplicando ${f}`)
    await sql(readFileSync(path, 'utf8'))
  }
  console.log('✅ Migrações aplicadas')
}

main().catch((e) => { console.error('\n❌', e.message); process.exit(1) })
