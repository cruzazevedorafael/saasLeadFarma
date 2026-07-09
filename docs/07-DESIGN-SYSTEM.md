# 07 — Design System (marca & UI)

Sistema visual do LeadFarma. Objetivo: profissional, leve e coerente — **não** com cara de template/IA.
Paleta oficial: **laranja · branco · preto**, com laranja como destaque *disciplinado* (só CTAs, foco, marca).

## Onde vive

- **Tokens & tema:** `app/globals.css` (fonte única da verdade). Light + dark.
- **Tipografia:** `app/layout.tsx` carrega as fontes via `next/font` (antes só declaradas, nunca carregadas).
- **Marca:** `components/brand/logo.tsx` → `<LogoMark/>` (símbolo) e `<Logo/>` (símbolo + wordmark).

## Cor

Neutros levam um leve tom quente (hue ~60) pra não parecerem "cinza de template".

| Token | Uso |
|---|---|
| `--brand` (`#F97316`) / `bg-primary`, `text-brand`, `bg-brand/10` | Destaque, CTAs, foco, marca |
| `--brand-hover` (`#ea6a04`) | Hover de superfícies laranja |
| `--brand-soft` | Fundos laranja bem suaves (badges, brilhos) |
| `--brand-contrast` | Texto sobre laranja (`text-primary-foreground`) |
| `--foreground` / `--background` / `--card` | Texto grafite quente sobre base branca |
| `--muted(-foreground)`, `--secondary`, `--accent` | Neutros de apoio, hovers — **nunca** laranja |
| `--chart-1..5` | Gráficos ancorados na marca (laranja + quentes + 1 teal) |

**Regra de ouro:** laranja é destaque, não preenchimento. Estrutura e texto são preto/grafite sobre branco.
Nunca usar `#F97316` hardcoded em componente novo — sempre o token (`bg-primary`, `text-brand`, `border-brand/40`…).
Exceção legítima: `theme_color` dos manifests PWA (precisa ser hex).

## Tipografia

- **Display (títulos `h1..h4`):** Plus Jakarta Sans — `font-display`, tracking apertado.
- **Corpo:** Inter — `font-sans`.

## Profundidade

Sombras quentes e sutis: `shadow-sm` / `shadow-md` / `shadow-lg` e `shadow-brand` (glow laranja p/ CTAs).
Cards: `bg-card border border-border shadow-sm`, hover sobe pra `shadow-md`.

## White-label (não confundir)

O **`accentColor` de cada farmácia** (banco) controla a cor do catálogo do cliente `/f/[slug]` — é
independente da marca do SaaS. O catálogo do cliente **não** deve ser amarrado ao laranja do LeadFarma.
