// lib/data/analytics.range.ts
// Resolve o período dos relatórios a partir dos searchParams. Puro (testável).
// Janelas "rolantes" (últimos N dias) — evitam borda de fuso horário do servidor.

export type RangePreset = 'dia' | 'semana' | 'mes' | 'ano' | 'custom'

export interface DateRange {
  since: string // ISO
  until: string // ISO
  preset: RangePreset
  label: string
}

const DIA = 86400_000

const PRESET_DAYS: Record<Exclude<RangePreset, 'custom'>, number> = {
  dia: 1,
  semana: 7,
  mes: 30,
  ano: 365,
}

const PRESET_LABEL: Record<RangePreset, string> = {
  dia: 'Últimas 24h',
  semana: 'Últimos 7 dias',
  mes: 'Últimos 30 dias',
  ano: 'Últimos 12 meses',
  custom: 'Período',
}

/** `now` injetável para teste (default = agora). */
export function resolveRange(
  sp: { range?: string; from?: string; to?: string },
  now: number = Date.now(),
): DateRange {
  const preset = (['dia', 'semana', 'mes', 'ano', 'custom'] as const).includes(sp.range as RangePreset)
    ? (sp.range as RangePreset)
    : 'ano'

  if (preset === 'custom') {
    const from = parseDate(sp.from)
    const to = parseDate(sp.to)
    if (from != null && to != null && from <= to) {
      // inclui o dia inteiro do "to"
      const until = to + DIA - 1
      const label = `${fmt(from)} – ${fmt(to)}`
      return { since: new Date(from).toISOString(), until: new Date(Math.min(until, now)).toISOString(), preset, label }
    }
    // custom inválido → cai pro padrão (ano)
    return rolling('ano', now)
  }
  return rolling(preset, now)
}

function rolling(preset: Exclude<RangePreset, 'custom'>, now: number): DateRange {
  const since = new Date(now - PRESET_DAYS[preset] * DIA).toISOString()
  return { since, until: new Date(now).toISOString(), preset, label: PRESET_LABEL[preset] }
}

function parseDate(s?: string): number | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const t = Date.parse(s + 'T00:00:00.000Z')
  return Number.isNaN(t) ? null : t
}

function fmt(ms: number): string {
  const d = new Date(ms)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}
