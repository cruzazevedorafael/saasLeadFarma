# 03 · Autenticação e papéis

## Papéis

| Papel | Quem | Onde vive |
|---|---|---|
| `superadmin` | operação LeadFarma (você) | `profiles.role='superadmin'`, `pharmacy_id = null` |
| `pharmacy_admin` | dono/operador de uma farmácia | `profiles.role='pharmacy_admin'`, `pharmacy_id = <farmácia>` |

Autenticação é feita pelo **Supabase Auth** (e-mail + senha). O usuário existe em `auth.users`; o **papel e a farmácia** vêm da tabela `profiles` (mesma `id` do usuário).

## Camada de código

### `lib/auth/session.ts`
```ts
getSessionProfile(): Promise<{ userId, role, pharmacyId } | null>
```
Lê o usuário autenticado (cookies) e o `profiles`. Base de tudo.

### `lib/auth/guards.ts` (para Server Components e Server Actions)
```ts
requireSuperadmin()                      // exige superadmin, senão redirect('/painel/login')
requirePharmacyAdmin({ skipOnboardingGate? })
                                         // exige pharmacy_admin; superadmin → /gestao;
                                         // onboarding incompleto → /painel/cadastro
getCurrentPharmacy(): Promise<Pharmacy>  // a farmácia do usuário logado
getCurrentPharmacyId(): Promise<string>  // id p/ setar pharmacy_id em inserts
```

## Middleware (`middleware.ts`) — roteamento por papel

Roda em `/painel/:path*` e `/gestao/:path*`. Regras:

| Situação | Resultado |
|---|---|
| Não logado em `/painel/*` (exceto `/painel/login`) ou `/gestao/*` | → `/painel/login` |
| `/gestao/*` sem ser `superadmin` | → `/painel` |
| `superadmin` em `/painel/*` | → `/gestao` |
| `pharmacy_admin` logado abrindo `/painel/login` | → `/painel` |
| `pharmacy_admin` com `onboarding_completed = false` (fora de `/painel/cadastro`) | → `/painel/cadastro` |

> O middleware faz a **primeira barreira** (redirecionamento). Os **guards** nas páginas/actions são a segunda barreira, e o **RLS no banco** é a barreira final e definitiva.

## Onboarding obrigatório

Ao criar uma farmácia, ela nasce com `onboarding_completed = false`. No primeiro acesso, o `pharmacy_admin` é **forçado** para `/painel/cadastro`, onde preenche os dados obrigatórios da empresa (razão social, nome fantasia, CNPJ, endereço completo, telefone, e-mail, farmacêutico responsável, CRF, WhatsApp). Ao salvar com sucesso (`app/painel/cadastro/actions.ts`, validado por Zod), `onboarding_completed` vira `true` e ele é liberado para o painel.

## Como um login é criado

- **Super-admin:** criado no seed (`scripts/seed-fase0.mjs`) via Auth Admin API + linha em `profiles`.
- **Farmácia:** criada pela **Gestão** (`/gestao` → "Nova farmácia"): a action `criarFarmacia` cria a linha em `pharmacies`, cria o usuário no Supabase Auth (senha inicial) e insere o `profiles` com `role='pharmacy_admin'`. Se qualquer passo falhar, desfaz os anteriores.

> Não há criação de login "por código solto" no app — sempre passa pela Gestão ou pelo seed, ambos usando a `service_role`.
