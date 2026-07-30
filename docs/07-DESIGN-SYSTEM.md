# 07 — Design System (marca & UI)

Sistema visual do LeadFarma. Objetivo: profissional, leve e coerente — **não** com cara de template/IA.
Paleta oficial: **60/30/10 azul + laranja** (complementares), com dois blocos de destaque escuro-âncora
(institucional + header do painel) inspirados na referência Hotmart. Laranja continua sendo o destaque
*disciplinado* (CTAs, foco, marca) — o que muda é a amplitude: entram fundo escuro e um violeta secundário,
usados com moderação.

## Onde vive

- **Tokens & tema:** `app/globals.css` (fonte única da verdade). Light + dark (`.dark`, via `next-themes`)
  + tokens de destaque fixos (`--ink`, `--violet`) que não variam por tema.
- **Tipografia:** `app/layout.tsx` carrega as fontes via `next/font`.
- **Marca:** `components/brand/logo.tsx` → `<LogoMark/>` (símbolo) e `<Logo/>` (símbolo + wordmark).

## Cor

Neutros levam um leve tom azulado (hue ~248-258) — fundo 60% dominante + cards brancos, texto/estrutura 30%,
laranja 10% de acento.

| Token | Uso |
|---|---|
| `--brand` (`#F97316`) / `bg-primary`, `text-brand`, `bg-brand/10` | Destaque, CTAs, foco, marca |
| `--brand-hover` (`#ea6a04`) | Hover de superfícies laranja |
| `--brand-soft` | Fundos laranja bem suaves (badges, brilhos) |
| `--brand-contrast` | Texto sobre laranja (`text-primary-foreground`) — grafite escuro, ~7:1 (WCAG AA) |
| `--ink` (`#0F1220`) / `bg-ink` | Fundo escuro-âncora: hero institucional, CTA final, header do painel |
| `--ink-foreground` / `text-ink-foreground` | Texto sobre `--ink` |
| `--violet` (`#6D3BF5`) / `bg-violet`, `text-violet` | Secundária: badges de plano, ilustração, fim do gradiente. Quebra deliberada do clichê ciano/verde-cruz de farmácia — nunca em área grande |
| `--gradient-brand` / `.bg-gradient-brand` | Laranja → violeta. Uso restrito: **no máximo 2 lugares por página** (hero + CTA final) |
| `--foreground` / `--background` / `--card` | Fundo azul-claro + cards brancos, texto grafite azulado |
| `--muted(-foreground)`, `--secondary`, `--accent` | Neutros de apoio, hovers — **nunca** laranja nem violeta |
| `--chart-1..5` | Gráficos ancorados na marca (laranja + azuis complementares + teal/âmbar) |

**Regra de ouro:** laranja é destaque, não preenchimento; violeta é ainda mais raro que laranja. `--ink` é
usado só em blocos inteiros (nunca como texto sobre fundo claro). Nunca usar `#F97316`/`#6D3BF5`/`#0F1220`
hardcoded em componente novo — sempre o token (`bg-primary`, `text-brand`, `bg-ink`, `border-brand/40`…).
Exceção legítima: `theme_color` dos manifests PWA (precisa ser hex).

## Tipografia

- **Display (títulos `h1..h4`):** Bricolage Grotesque — `font-display`, tracking apertado (`-0.02em` a
  `-0.03em`), pesos 700/800. Grotesca editorial com caráter — decisão fechada (era a opção A de um teste
  A/B/C em `/fontes`, removida do projeto).
- **Corpo:** Inter — `font-sans`.
- Números (preço, quantidade, totais, tabelas): `font-variant-numeric: tabular-nums` — já aplicado em
  `components/ui/metric-card.tsx`; manter em qualquer componente novo que exiba números que atualizam.

## Profundidade

Sombras quentes e sutis: `shadow-sm` / `shadow-md` / `shadow-lg` e `shadow-brand` (glow laranja p/ CTAs).
Cards: `bg-card border border-border shadow-sm`, hover sobe pra `shadow-md`.

## Animação

- Landing: fade + subida sutil (8-12px, ~250ms), dispara uma vez por elemento (`whileInView`, `once: true`),
  sem parallax, carrossel automático ou loop.
- Painel: quase invisível (120-160ms), sem reveal de scroll. Exceção: `.order-highlight` (pulso laranja que
  desvanece em ~2s) no destaque de pedido novo na lista de pedidos.
- Tudo respeita `prefers-reduced-motion: reduce` (ver `app/globals.css`).

## White-label (não confundir)

O **`accentColor` de cada farmácia** (banco) controla a cor do catálogo do cliente `/f/[slug]` — é
independente da marca do SaaS. O catálogo do cliente **não** deve ser amarrado ao laranja/violeta do LeadFarma.
