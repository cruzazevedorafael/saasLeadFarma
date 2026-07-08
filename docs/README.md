# LeadFarma — Documentação do Sistema

> Documentação **as-built** (gerada a partir do código real). Estado: **Fase 0 concluída** (fundação multi-tenant). Última atualização: 2026-07-08.

O **LeadFarma** é um **SaaS multi-tenant** de **catálogo online para farmácias**. Cada farmácia monta o próprio catálogo num painel, e o cliente final acessa esse catálogo (com a marca da farmácia), monta um pedido e envia por **WhatsApp**.

## Índice

| Documento | O que contém |
|---|---|
| [00 · Visão geral](./00-VISAO-GERAL.md) | O que é, para quem, as 3 superfícies, o roadmap de fases |
| [01 · Arquitetura](./01-ARQUITETURA.md) | Stack, multi-tenancy, estrutura de pastas, fluxo de requisição |
| [02 · Banco de dados](./02-BANCO-DE-DADOS.md) | Tabelas, colunas, RLS, funções, views |
| [03 · Autenticação e papéis](./03-AUTENTICACAO-E-PAPEIS.md) | Papéis, middleware, guards, onboarding |
| [04 · Superfícies e rotas](./04-SUPERFICIES-E-ROTAS.md) | Catálogo, painel, gestão — rotas e arquivos-chave |
| [05 · Setup e execução](./05-SETUP-E-EXECUCAO.md) | Variáveis de ambiente, instalar, rodar, seed, credenciais de teste |
| [06 · Manutenção e roadmap](./06-MANUTENCAO-E-ROADMAP.md) | Como evoluir, convenções, as próximas fases |

## Atalhos rápidos

- **Rodar:** `pnpm install` → `pnpm dev` → http://localhost:3000
- **Catálogo demo:** `/f/farmacia-teste`
- **Gestão (super-admin):** `/gestao`
- **Painel da farmácia:** `/painel`
- **Specs e planos por fase:** [`docs/superpowers/`](./superpowers/)
