# Reserva de estoque no carrinho

Data: 2026-06-15

## Contexto

A loja quer que, ao colocar um item no carrinho, a peça fique **travada** para
que outro cliente não compre a mesma enquanto isso. Hoje:

- O carrinho é só no navegador (`lib/store.ts`, zustand + localStorage). Não toca
  no banco.
- O estoque só sai quando o pedido é finalizado (`criarPedido` → `reserve_order`,
  migration 0015).
- Clientes são anônimos (acessam pelo link do WhatsApp, sem login).

## Decisões

- **Expiração: 30 minutos.** Sem expiração, um carrinho abandonado travaria a peça
  para sempre. Os 30 min renovam a cada mexida no carrinho.
- **Abordagem A — reserva no banco** (escolhida). Tabela de reservas + id de
  carrinho anônimo + disponibilidade = estoque − reservas ativas. Rejeitadas:
  criar pedido pendente já no carrinho (enche o painel, não expira sozinho); trava
  só no navegador (impossível travar entre pessoas diferentes).
- **Disponibilidade exibida desconta TODAS as reservas ativas**, inclusive as do
  próprio cliente. Conservador (nunca vende a mais). Efeito colateral aceito: se o
  cliente reservar a última peça, a vitrine mostra "Esgotado" para ela, embora
  esteja no carrinho dele. Some quando a reserva expira ou o pedido é finalizado.
- A **garantia real é no momento de adicionar**: a função SQL trava a linha da
  variação (`for update`) e concede no máximo o disponível. A vitrine é dica visual.

## Desenho

### Tabela `cart_reservations`

```
id          uuid primary key default gen_random_uuid()
cart_id     uuid not null            -- id anônimo do navegador
variant_id  uuid not null references product_variants(id) on delete cascade
quantity    int  not null check (quantity > 0)
expires_at  timestamptz not null
updated_at  timestamptz not null default now()
unique (cart_id, variant_id)
index (variant_id)
index (expires_at)
```

Sem RLS para anon de escrita direta — todo acesso é via funções `security definer`
chamadas pelas server actions (service_role). A leitura de disponibilidade é
agregada no servidor.

### Id de carrinho

Um `cartId` (uuid) gerado no cliente e persistido no localStorage, dentro do store
zustand existente (`lib/store.ts`). Criado de forma preguiçosa na primeira vez que
o carrinho precisa dele. Reusa `crypto.randomUUID()`.

### Funções SQL (atômicas, `security definer`, só `service_role`)

- **`reservar_item(p_cart_id uuid, p_variant_id uuid, p_quantity int) returns int`**
  1. `delete from cart_reservations where expires_at <= now()` (limpeza oportunista).
  2. `select ... for update` na linha de `product_variants` (serializa a corrida).
  3. `reservado_outros = sum(quantity)` das reservas válidas com
     `variant_id = p_variant_id and cart_id <> p_cart_id`.
  4. `disponivel = stock - reservado_outros` (mínimo 0).
  5. `conceder = least(p_quantity, disponivel)`.
  6. Se `conceder <= 0`: apaga a reserva desse carrinho para a variação e retorna 0.
     Senão: `upsert` `(cart_id, variant_id)` com `quantity = conceder`,
     `expires_at = now() + interval '30 minutes'`, `updated_at = now()`.
  7. Retorna `conceder` (quanto foi efetivamente reservado).

- **`liberar_item(p_cart_id uuid, p_variant_id uuid) returns void`** — apaga a
  reserva daquele carrinho para a variação.

- **`liberar_carrinho(p_cart_id uuid) returns void`** — apaga todas as reservas do
  carrinho (usado após finalizar o pedido e ao limpar o carrinho).

### Disponibilidade na vitrine

A consulta pública dos produtos passa a expor o estoque **já descontado** das
reservas ativas. Em vez de ler `stock` cru, lê
`stock - coalesce(reservas_ativas, 0)` por variação (reservas com
`expires_at > now()`). Isso é feito numa view/consulta no servidor; o
`ProductCard` continua usando esse número como `maxStock`/disponibilidade.

> A vitrine é uma dica que atualiza no carregamento/revalidação. A verdade está em
> `reservar_item`, que nunca concede além do disponível real no instante do clique.

### Server actions (Next.js)

Em um novo arquivo `app/_actions/reserva-carrinho.ts`:

- `reservarItem(cartId, variantId, quantity)` → chama `reservar_item`, retorna o
  quanto foi concedido.
- `liberarItem(cartId, variantId)` → chama `liberar_item`.
- `liberarCarrinho(cartId)` → chama `liberar_carrinho`.

O `lib/store.ts` chama essas actions quando o carrinho muda:
- `addItem` / aumento de quantidade → `reservarItem`; se o concedido for menor que
  o pedido, o store ajusta a quantidade e marca um aviso para a UI mostrar
  ("só sobraram X").
- `removeItem` / diminuição → `liberarItem` (ou novo `reservarItem` com a quantidade
  menor).
- `clearCart` → `liberarCarrinho`.
- Ao montar (página carrega com carrinho salvo) → re-pede cada item com
  `reservarItem` (renova os 30 min); ajusta o que não estiver mais disponível.

### Finalização do pedido

`criarPedido` ganha um parâmetro opcional `cartId`. Depois de `reserve_order`
(baixa do estoque real), chama `liberar_carrinho(cartId)` para que as reservas
daquele carrinho não fiquem descontando o estoque duas vezes. O componente
`components/cart.tsx` passa o `cartId` no `criarPedido` e roda `clearCart` no
sucesso (que já dispara `liberarCarrinho`).

## Tratamento de erros / corrida

- Dois clientes na última peça: `for update` na linha da variação serializa; o
  primeiro reserva, o segundo recebe `conceder = 0` e vê "Esgotado/indisponível".
- Falha de rede ao reservar: o item entra no carrinho local mesmo assim, mas sem
  garantia; ao finalizar, `reserve_order` + o aviso de estoque insuficiente
  (que já existe) cobrem o caso. A reserva é "best effort" no clique e definitiva
  no pedido.
- Reserva vencida quando o cliente volta: o re-pedido no mount tenta renovar; se
  não conseguir tudo, ajusta a quantidade e avisa.

## Fora de escopo (YAGNI)

- Painel não lista reservas ativas (são transitórias).
- Sem heartbeat contínuo; os 30 min renovam a cada mudança no carrinho e no load.
- Sem limpeza por cron dedicada — a limpeza oportunista dentro de `reservar_item`
  basta para uma loja pequena.

## Migration

`supabase/migrations/0016_reserva_carrinho.sql`: cria a tabela, os índices, as três
funções e ajusta a consulta/view de disponibilidade. Aplicado manualmente no painel
do Supabase, antes do merge na main (deploy automático).

## Testes

- `lib/store` (ou helper extraído): geração preguiçosa do `cartId`; ajuste da
  quantidade quando o concedido é menor que o pedido (clamp + aviso).
- Helper de disponibilidade, se extraído para JS, testado com reservas ativas e
  vencidas.
- `criar-pedido.test.ts`: garantir que `liberar_carrinho` é chamado após a reserva
  quando há `cartId`.
- Verificação manual: dois navegadores na última peça; expiração após 30 min;
  finalizar pedido libera a reserva; recarregar renova.
