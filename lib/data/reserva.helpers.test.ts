import { describe, it, expect } from 'vitest'
import { addableFromGrant } from './reserva.helpers'

describe('addableFromGrant', () => {
  it('quanto ainda dá pra adicionar = concedido menos o que já está no carrinho', () => {
    expect(addableFromGrant(5, 2)).toBe(3)
  })
  it('nunca negativo', () => {
    expect(addableFromGrant(2, 3)).toBe(0)
  })
  it('zero concedido = nada a adicionar', () => {
    expect(addableFromGrant(0, 0)).toBe(0)
  })
})
