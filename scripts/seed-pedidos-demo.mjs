// scripts/seed-pedidos-demo.mjs
// Cria alguns pedidos concluídos de exemplo (com cliente + LGPD) para a farmácia
// de teste, alimentando /painel/clientes, /painel/relatorios e os comprovantes.
// Idempotente: remove os pedidos do cliente demo antes de recriar.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = {}
for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m) env[m[1]] = m[2]
}
const REF = new URL(env.NEXT_PUBLIC_SUPABASE_URL).host.split('.')[0]
const PAT = env.SUPABASE_ACCESS_TOKEN
if (!REF || !PAT) { console.error('Faltam variáveis em .env.local'); process.exit(1) }
async function sql(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: q }),
  })
  const t = await r.text(); if (!r.ok) throw new Error(t); return t ? JSON.parse(t) : []
}
const esc = (s) => String(s).replace(/'/g, "''")
const CPF = '52998224725'

async function main() {
  const ph = (await sql("select id from public.pharmacies where slug='farmacia-teste'"))[0]?.id
  if (!ph) { console.error('Rode seed-fase0 + seed-produtos-demo antes.'); process.exit(1) }

  const prods = await sql(`select p.id, p.code, p.name, p.price_retail,
      (select v.id from public.product_variants v where v.product_id = p.id limit 1) as variant_id,
      (select v.size from public.product_variants v where v.product_id = p.id limit 1) as size,
      (select v.color from public.product_variants v where v.product_id = p.id limit 1) as color
    from public.products p where p.pharmacy_id='${ph}' order by p.sort_order limit 4`)
  if (prods.length === 0) { console.error('Sem produtos demo. Rode seed-produtos-demo.'); process.exit(1) }

  // cliente demo (com consentimento) + limpa pedidos anteriores dele
  const cid = (await sql(`select public.upsert_customer('${ph}','${CPF}','Maria Silva','11988887777',
    '01001000','Praça da Sé','100','','Sé','São Paulo','SP',true) as id`))[0].id
  await sql(`delete from public.orders where pharmacy_id='${ph}' and customer_cpf='${CPF}'`)
  await sql(`update public.customers set orders_count=0 where id='${cid}'`)

  // 3 pedidos concluídos em datas/horas diferentes
  const cenarios = [
    { dias: 20, hora: 10, itens: [[0, 2], [2, 1]] },
    { dias: 8, hora: 15, itens: [[1, 1]] },
    { dias: 2, hora: 19, itens: [[0, 3], [3, 2]] },
  ]
  for (const c of cenarios) {
    const quando = `now() - interval '${c.dias} days' + interval '${c.hora} hours'`
    let subtotal = 0
    const items = c.itens.map(([idx, qtd]) => {
      const p = prods[idx % prods.length]
      subtotal += Number(p.price_retail) * qtd
      return { p, qtd }
    })
    subtotal = Math.round(subtotal * 100) / 100
    const ord = (await sql(`insert into public.orders
      (pharmacy_id, customer_id, customer_name, customer_phone, customer_cpf,
       customer_cep, customer_logradouro, customer_numero, customer_bairro, customer_cidade, customer_uf,
       status, price_type, items_subtotal, total, shipping_label, payment_label, created_at, completed_at)
      values ('${ph}','${cid}','Maria Silva','11988887777','${CPF}',
       '01001000','Praça da Sé','100','Sé','São Paulo','SP',
       'completed','retail',${subtotal},${subtotal},'Retirada','Pix', ${quando}, ${quando})
      returning id`))[0].id
    for (const { p, qtd } of items) {
      await sql(`insert into public.order_items
        (pharmacy_id, order_id, product_id, variant_id, product_code, product_name, size, color, quantity, unit_price)
        values ('${ph}','${ord}','${p.id}',${p.variant_id ? `'${p.variant_id}'` : 'null'},
        '${esc(p.code ?? '')}','${esc(p.name)}','${esc(p.size ?? '')}','${esc(p.color ?? '')}',${qtd},${p.price_retail})`)
    }
    await sql(`select public.increment_customer_orders('${cid}')`)
    console.log(`  ✓ pedido concluído (${c.dias}d atrás) — ${items.length} item(ns), R$ ${subtotal}`)
  }
  console.log('\n✅ Pedidos demo criados. Veja /painel/relatorios, /painel/clientes e os comprovantes.')
}
main().catch((e) => { console.error('\n❌', e.message); process.exit(1) })
