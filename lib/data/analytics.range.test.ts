import { describe, it, expect } from 'vitest'
import { resolveRange } from './analytics.range'

const NOW = Date.parse('2026-07-13T12:00:00.000Z')
const DIA = 86400_000

describe('resolveRange', () => {
  it('default (sem range) = últimos 365 dias', () => {
    const r = resolveRange({}, NOW)
    expect(r.preset).toBe('ano')
    expect(Date.parse(r.since)).toBe(NOW - 365 * DIA)
    expect(Date.parse(r.until)).toBe(NOW)
  })

  it('presets rolantes', () => {
    expect(Date.parse(resolveRange({ range: 'dia' }, NOW).since)).toBe(NOW - 1 * DIA)
    expect(Date.parse(resolveRange({ range: 'semana' }, NOW).since)).toBe(NOW - 7 * DIA)
    expect(Date.parse(resolveRange({ range: 'mes' }, NOW).since)).toBe(NOW - 30 * DIA)
  })

  it('range inválido cai pro padrão', () => {
    expect(resolveRange({ range: 'xpto' }, NOW).preset).toBe('ano')
  })

  it('custom válido usa from/to (to inclui o dia inteiro)', () => {
    const r = resolveRange({ range: 'custom', from: '2026-07-01', to: '2026-07-10' }, NOW)
    expect(r.preset).toBe('custom')
    expect(Date.parse(r.since)).toBe(Date.parse('2026-07-01T00:00:00.000Z'))
    expect(Date.parse(r.until)).toBe(Date.parse('2026-07-10T00:00:00.000Z') + DIA - 1)
  })

  it('custom inválido (from > to) cai pro padrão', () => {
    expect(resolveRange({ range: 'custom', from: '2026-07-10', to: '2026-07-01' }, NOW).preset).toBe('ano')
  })

  it('custom não passa do agora', () => {
    const r = resolveRange({ range: 'custom', from: '2026-07-01', to: '2099-01-01' }, NOW)
    expect(Date.parse(r.until)).toBe(NOW)
  })
})
