// lib/data/reserva.helpers.ts

// Dado quanto o servidor concedeu de reserva para uma variação (total) e quanto
// já existe no carrinho dessa variação, devolve quanto ainda pode ser adicionado.
export function addableFromGrant(granted: number, alreadyInCart: number): number {
  return Math.max(0, granted - alreadyInCart)
}
