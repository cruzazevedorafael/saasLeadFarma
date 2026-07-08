// lib/cpf.ts — utilidades de CPF (só dígitos internamente).

/** Mantém só os dígitos. */
export function onlyDigits(v: string): string {
  return (v || '').replace(/\D/g, '')
}

/** Formata para 000.000.000-00 (parcial enquanto digita). */
export function formatCpf(v: string): string {
  const d = onlyDigits(v).slice(0, 11)
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9), d.slice(9, 11)]
  let out = p[0]
  if (p[1]) out += '.' + p[1]
  if (p[2]) out += '.' + p[2]
  if (p[3]) out += '-' + p[3]
  return out
}

/** Valida CPF pelos dígitos verificadores (rejeita sequências iguais). */
export function isValidCpf(v: string): boolean {
  const d = onlyDigits(v)
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false
  const calc = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}
