// scripts/seed-produtos-demo.mjs
// Popula a farmácia de teste com produtos de farmácia realistas (Fase 1).
// Idempotente: apaga os produtos demo (por código) e reinsere. Lê .env.local.
// Uso: node scripts/seed-produtos-demo.mjs
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const env = {}
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2]
}
const REF = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host.split('.')[0]
const PAT = env.SUPABASE_ACCESS_TOKEN
if (!REF || !PAT) { console.error('Faltam variáveis em .env.local'); process.exit(1) }

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
const esc = (s) => String(s).replace(/'/g, "''")

// [code, name, brand, category, requires_prescription, description, price_retail, price_wholesale, variants[{presentation,dosage,stock}]]
const PRODUTOS = [
  ['7891058014957', 'Dipirona Sódica', 'Neo Química', 'Medicamentos', false,
    'Analgésico e antitérmico para dores e febre.', 8.90, 6.90,
    [['Caixa 10 comp.', '500 mg', 40], ['Caixa 10 comp.', '1 g', 25]]],
  ['7896006267201', 'Amoxicilina', 'EMS', 'Medicamentos', true,
    'Antibiótico de amplo espectro. Uso sob prescrição médica.', 24.50, 19.90,
    [['Caixa 21 cáps.', '500 mg', 15]]],
  ['7891058006549', 'Vitamina C', 'Vitasay', 'Vitaminas', false,
    'Suplemento vitamínico efervescente, sabor laranja.', 19.90, 15.90,
    [['Tubo 10 comp.', '1 g', 30], ['Tubo 30 comp.', '1 g', 18]]],
  ['7896714213521', 'Protetor Solar FPS 50', 'Sundown', 'Dermocosméticos', false,
    'Proteção UVA/UVB, resistente à água, toque seco.', 45.90, 38.90,
    [['Bisnaga 120 g', 'FPS 50', 22]]],
  ['7891142200013', 'Álcool em Gel 70%', 'Asseptgel', 'Higiene e Cuidados', false,
    'Higienizador para as mãos, ação antisséptica.', 12.90, 9.90,
    [['Frasco 500 ml', '70%', 50]]],
  ['7896004707013', 'Soro Fisiológico 0,9%', 'Fresenius', 'Higiene e Cuidados', false,
    'Solução para limpeza nasal e ocular.', 6.50, 4.90,
    [['Frasco 500 ml', '0,9%', 35]]],
]

async function main() {
  const ph = await sql(`select id from public.pharmacies where slug = 'farmacia-teste' limit 1`)
  if (!ph[0]?.id) { console.error('Farmácia de teste não encontrada. Rode scripts/seed-fase0.mjs antes.'); process.exit(1) }
  const phId = ph[0].id
  console.log('Farmácia:', phId)

  // categorias (nome único por farmácia)
  const cats = [...new Set(PRODUTOS.map((p) => p[3]))]
  for (let i = 0; i < cats.length; i++) {
    await sql(`insert into public.categories (pharmacy_id, name, sort_order)
      values ('${phId}', '${esc(cats[i])}', ${i})
      on conflict (pharmacy_id, name) do nothing`)
  }
  console.log('Categorias:', cats.join(', '))

  // limpa os produtos demo antes (idempotência) — cascade apaga as variações
  const codes = PRODUTOS.map((p) => `'${esc(p[0])}'`).join(',')
  await sql(`delete from public.products where pharmacy_id = '${phId}' and code in (${codes})`)

  for (let i = 0; i < PRODUTOS.length; i++) {
    const [code, name, brand, category, rx, desc, retail, wholesale, variants] = PRODUTOS[i]
    const rows = await sql(`insert into public.products
      (pharmacy_id, code, name, brand, category, requires_prescription, description,
       price_retail, price_wholesale, min_wholesale, counts_for_wholesale, active, sort_order)
      values ('${phId}', '${esc(code)}', '${esc(name)}', '${esc(brand)}', '${esc(category)}',
       ${rx}, '${esc(desc)}', ${retail}, ${wholesale}, 1, true, true, ${i})
      returning id`)
    const prodId = rows[0].id
    for (const [presentation, dosage, stock] of variants) {
      await sql(`insert into public.product_variants (pharmacy_id, product_id, size, color, stock)
        values ('${phId}', '${prodId}', '${esc(presentation)}', '${esc(dosage)}', ${stock})`)
    }
    console.log(`  ✓ ${name} (${brand})${rx ? ' — receita' : ''} · ${variants.length} apresentação(ões)`)
  }
  console.log('\n✅ Produtos demo inseridos. Veja em /f/farmacia-teste')
}

main().catch((e) => { console.error('\n❌', e.message); process.exit(1) })
