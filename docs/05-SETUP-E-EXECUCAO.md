# 05 · Setup e execução

## Pré-requisitos
- Node.js 20+ (testado no 24)
- pnpm
- Um projeto Supabase (o atual: `emfraxjwxkvaxnvkubpz`)

## Variáveis de ambiente

Crie um `.env.local` na raiz (**nunca versionado** — está no `.gitignore` como `.env*.local`). Modelo em `.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>   # SECRETA — só no servidor
SUPABASE_ACCESS_TOKEN=sbp_...                  # PAT — usado só pelo script de seed/migração

# ASAAS (Fase 5) — OPCIONAIS. Sem elas o SaaS roda em modo manual/teste
# (farmácias em trial/ativas, sem cobrança). Preencher quando a conta for aprovada:
ASAAS_API_KEY=$aact_...                         # chave da conta ASAAS
ASAAS_ENV=sandbox                               # sandbox | production
ASAAS_WEBHOOK_TOKEN=<token>                     # valida os webhooks em /api/asaas/webhook
```

> ⚠️ **Segurança:** `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ACCESS_TOKEN` dão acesso total. Nunca comitar; se vazarem, **rotacionar** no painel do Supabase (Project Settings → API).

## Instalar e rodar

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

Outros comandos:
```bash
pnpm build        # build de produção
pnpm start        # sobe o build de produção
pnpm test         # roda os testes (vitest)
pnpm lint         # eslint
```

> Dica: rode **um único** `pnpm dev` por vez. Duas instâncias na mesma pasta compartilham `.next` e derrubam os workers do Turbopack (erros 500 falsos).

## Aplicar o schema + criar dados iniciais

O script aplica as migrations da Fase 0 e cria o super-admin, uma farmácia de teste e o login dela (idempotente):

```bash
node scripts/seed-fase0.mjs
```

Ele lê tudo do `.env.local` e usa a Management API (PAT) + Auth Admin (service_role).

### Migrations posteriores e dados demo

```bash
# aplica uma ou mais migrations (idempotentes) — usado nas Fases 1–6
node scripts/apply-migration.mjs supabase/migrations/0003_produto_farmacia.sql \
  supabase/migrations/0004_clientes_lgpd.sql \
  supabase/migrations/0005_planos_assinaturas.sql \
  supabase/migrations/0006_pharmacies_anon_colunas.sql

node scripts/gen-icons.mjs           # gera public/icon-192.png e icon-512.png (PWA)
node scripts/seed-produtos-demo.mjs  # produtos de farmácia de exemplo
node scripts/seed-pedidos-demo.mjs   # pedidos concluídos + cliente (alimenta relatórios/clientes/comprovantes)
```

## Credenciais de teste (ambiente de desenvolvimento)

| Acesso | URL | Login | Senha |
|---|---|---|---|
| **Gestão (super-admin)** | `/gestao` | `leadfarma.br@gmail.com` | `Projetarcode321@` |
| **Painel (farmácia teste)** | `/painel/login` | `farmaciateste@leadfarma.br` | `FarmaciaTeste321@` |
| **Catálogo demo** | `/f/farmacia-teste` | — | — |

> Estas senhas são de **teste**. Troque-as (ou rotacione as chaves) antes de qualquer uso real.

## Deploy (Vercel)

O projeto é um app Next.js padrão, pronto para deploy na Vercel. No deploy, configurar as mesmas variáveis de ambiente no painel da Vercel (as `NEXT_PUBLIC_*` e a `SUPABASE_SERVICE_ROLE_KEY`; o `SUPABASE_ACCESS_TOKEN` só é necessário para rodar o seed localmente). A configuração fina de domínio/URL por farmácia é tema da **Fase 4 (PWA white-label)**.
