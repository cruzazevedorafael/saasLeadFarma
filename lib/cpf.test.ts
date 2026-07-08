import { describe, it, expect } from 'vitest'
import { onlyDigits, formatCpf, isValidCpf } from './cpf'

describe('cpf', () => {
  it('onlyDigits tira máscara', () => {
    expect(onlyDigits('529.982.247-25')).toBe('52998224725')
  })

  it('formatCpf monta a máscara progressivamente', () => {
    expect(formatCpf('529')).toBe('529')
    expect(formatCpf('529982')).toBe('529.982')
    expect(formatCpf('52998224725')).toBe('529.982.247-25')
    expect(formatCpf('5299822472599')).toBe('529.982.247-25') // corta em 11
  })

  it('isValidCpf aceita CPF válido', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
  })

  it('isValidCpf rejeita inválido, tamanho errado e sequência repetida', () => {
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('123')).toBe(false)
    expect(isValidCpf('')).toBe(false)
  })
})
