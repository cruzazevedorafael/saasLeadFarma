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
                                         // skipOnboardingGate: usado em /painel/assinatura,
                                         // pra deixar assinar mesmo antes de terminar o cadastro
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

> O middleware faz a **primeira barreira** (redirecionamento). Os **guards** nas páginas/actions são a segunda barreira, e o **RLS no banco** é a barreira final e definitiva. A rota pública `/cadastro` (auto-cadastro, Fase 5) não passa pelo middleware — é acessível a qualquer visitante.

## Onboarding obrigatório

Ao criar uma farmácia (pela Gestão **ou** pelo auto-cadastro), ela nasce com `onboarding_completed = false`. No primeiro acesso, o `pharmacy_admin` é **forçado** para `/painel/cadastro`, onde preenche os dados obrigatórios da empresa (razão social, nome fantasia, CNPJ, endereço completo, telefone, e-mail, farmacêutico responsável, CRF, WhatsApp). Ao salvar com sucesso (`app/painel/cadastro/actions.ts`, validado por Zod), `onboarding_completed` vira `true` e ele é liberado para o painel.

## Como um login é criado

Toda criação de farmácia + login passa pela função compartilhada **`provisionPharmacy`** (`lib/data/pharmacy-provisioning.ts`): cria a linha em `pharmacies`, o usuário no Supabase Auth (Auth Admin API) e o `profiles` com `role='pharmacy_admin'`, de forma atômica (desfaz os passos anteriores se algum falhar). Dois pontos de entrada chamam essa função:

- **Super-admin:** criado no seed (`scripts/seed-fase0.mjs`) via Auth Admin API + linha em `profiles` (fora do `provisionPharmacy`, é um caminho separado só para o operador da plataforma).
- **Farmácia via Gestão:** `/gestao` → "Nova farmácia" — a action `criarFarmacia` (`app/gestao/actions.ts`) chama `provisionPharmacy` com slug/e-mail/senha definidos pelo super-admin.
- **Farmácia via auto-cadastro (Fase 5):** `/cadastro` — a action `autoCadastro` (`app/cadastro/actions.ts`) gera um slug único a partir do nome, chama `provisionPharmacy` com `plan: 'trial'` e `trialDays: 14`, e **loga o usuário automaticamente** (`signInWithPassword`) antes de redirecionar para `/painel/cadastro`.

> Não há criação de login "por código solto" no app — sempre passa pela Gestão, pelo auto-cadastro ou pelo seed, todos usando a `service_role`.
