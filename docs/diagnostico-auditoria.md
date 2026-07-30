# Diagnóstico da Auditoria — LeadFarma

_Data: 2026-07-13. Varredura completa por 4 frentes (segurança, arquitetura, QA, performance). Somente diagnóstico — nenhum arquivo de produção foi alterado._

## Nota geral: **7,0 / 10**

Resumo honesto: o **código é bem feito** (arquivos pequenos, lógica pura isolada e testada, isolamento entre farmácias disciplinado). O que segura a nota são os **guard-rails**: o build ignora erro de tipo, o lint nunca funcionou, não existe nenhuma tela de erro/loading, e três endpoints anônimos podem ser abusados. É "boa engenharia sem rede de segurança".

| Dimensão | Nota | Veredito |
|---|---|---|
| Segurança (isolamento entre tenants) | 8,0 | Sólido. Nenhum vazamento entre farmácias comprovado. |
| Arquitetura / qualidade de código | 6,5 | Código limpo, guard-rails furados. |
| Testes | 7,0 | 108/108 passam; caminho do dinheiro sem teste. |
| Peso / performance | 6,0 | Emagrece fácil; catálogo dinâmico por acidente. |

---

## O que está BOM (confirmado no código, não é elogio vazio)

- **Isolamento entre farmácias fechado.** `.eq('pharmacy_id')` presente em 100% das ~25 actions autenticadas. RLS habilitado em todas as tabelas, deny-by-default em `cart_reservations` e `gtin_cache`, sem policy `using(true)` ativa.
- **Preço/total sempre relidos do servidor.** Manipular o front não muda o valor gravado (`criar-pedido.ts`).
- **PII cadastral protegida** (CNPJ, e-mail, CRF, IDs de pagamento invisíveis ao catálogo público).
- **108 testes passam**, cobrindo as joias: criar pedido, reserva/baixa de estoque, cálculo de total, CPF, carrinho.
- **Disciplina de tamanho de arquivo**: só 2 arquivos nossos passam de 300 linhas.
- **Server/Client Components corretos**: nenhum `page.tsx` é client; zero `console.log`, zero `@ts-ignore`.
- **Git limpo de segredos.**

---

## O que FALTA melhorar (por prioridade)

### 🔴 Rede de segurança (fazer primeiro)
1. **`ignoreBuildErrors: true`** no `next.config.mjs:4` — o build passa com erro de tipo. Medi: hoje há **só 1 erro**, num arquivo de teste (`receipt.test.ts:6`, falta `catalogFont: null`). Dá pra remover a flag em ~10 min.
2. **Lint nunca funcionou** — o script `"lint"` existe desde o commit 1, mas o `eslint` não está instalado. Nunca rodou análise estática. (Precisa decidir o preset — Next 16 + React 19.)
3. **Zero `error.tsx` / `loading.tsx` / `not-found.tsx`** em toda a app. Qualquer falha do Supabase = tela branca genérica pro lojista.

### ⚠️ Abuso de endpoints anônimos (segurança)
4. **`buscar-cliente.ts` sem rate limit** — com um CPF, dá pra forçar bruta os 4 dígitos do celular e recuperar nome+endereço+telefone (LGPD).
5. **`reserva-carrinho.ts` sem teto** — dá pra reservar todo o estoque de qualquer farmácia e deixar tudo "esgotado" por 30 min (sabotagem).
6. **Webhook Asaas fail-open** (`route.ts:16`) — se `ASAAS_WEBHOOK_TOKEN` não estiver setado, aceita qualquer POST e muda status de assinatura. Deve falhar fechado.

### ⚠️ Bug no código novo (scanner)
7. **Cache de GTIN envenena "não encontrado"** (`gtin-actions.ts`) — se a API externa der timeout, grava "não encontrado" **permanente e global** (a tabela é compartilhada entre todas as farmácias). Não cachear em erro de rede; só em 404 real.

### Dívidas médias
8. Fórmula de preço **duplicada** cliente/servidor (`cart.tsx:54` vs `order.helpers.ts:81`) — hoje batem; risco de divergir.
9. Sem **tipos gerados do Supabase** → ~28 `any` e nenhuma query checada contra o schema.
10. Isolamento de tenant por **disciplina** (service role em todo write) — falta um `tenantDb(pharmacyId)` que force o filtro por construção.
11. `revalidatePath('/')` aponta pra landing, não pro catálogo `/f/[slug]` (sobra da era single-tenant) — hoje inócuo, vira bug quando o catálogo virar estático.

---

## Como deixar MAIS LEVE (plano de emagrecimento, medido)

Total de JS client hoje: **2,7 MB raw** em disco. Ordem por ganho/esforço:

| # | Ação | Ganho | Esforço | Risco |
|---|---|---|---|---|
| 1 | **Catálogo estático/ISR**: tirar `getSessionProfile()` do render + `export const revalidate` em `app/f/[slug]/page.tsx` | Rota mais acessada passa a ser servida da CDN em vez de função a cada acesso (maior ganho de TTFB/LCP) | Baixo | Baixo |
| 2 | **Remover peso morto**: recharts + cmdk + vaul + input-otp + react-day-picker + react-resizable-panels + sonner + **41 componentes `ui/` órfãos** + 17 `@radix-ui` órfãos (~64 dependências) | Install/build mais leves, menos superfície | Baixo | Baixo (não são importados) |
| 3 | `optimizePackageImports: ['lucide-react','date-fns']` no next.config | Dezenas de KB no `/painel` | Baixo | Baixo |
| 4 | **Lazy-load do PDF**: `pdf-58mm.ts` é `import` estático → jspdf+html2canvas (~172 KB gzip) carregam ao abrir o pedido, não ao gerar comprovante. Trocar por `await import()` (o `pdf-a4` já é) | ~172 KB gzip fora de `/painel/pedidos/[id]` | Baixo | Baixo |
| 5 | **Ligar otimização de imagem** (tirar `unoptimized:true`) + migrar `<img>` → `next/image` + `remotePatterns` do Supabase | Logos/fotos de MBs → dezenas de KB (WebP/AVIF) | Médio | Médio |
| 6 | **framer-motion → CSS** (`tw-animate-css`, já instalado) nos 51 usos de fade/slide/scale da rota crítica | ~108 KB gzip fora do catálogo | Alto | Médio (regressão visual) |

**Correções ao que se suspeitava:** o `hero-landing.png` de 2,5 MB **não está referenciado em nenhum lugar** — não pesa em nenhuma rota hoje (só não vale ligar na landing sem `next/image`). E o scanner `@zxing/browser` (121 KB) **já é lazy** — está correto.

---

## Como reverter
Nenhuma alteração foi feita. Ao aplicar correções, faço snapshot (`git commit`) por grupo antes de cada uma.
