# Pedidos, cupons e checkout

Como a API reserva ingressos sob alta concorrência sem vender o mesmo ingresso
duas vezes, aplica cupons de desconto e conduz o pedido até o pagamento ou o
cancelamento.

## Modelo

| Coupon | Tipo | Regra |
| --- | --- | --- |
| `code` | 3 a 32 caracteres | Gravado em maiúsculas; único por evento (`VERAO15` e `verao15` são o mesmo) |
| `discountType` | `percentage` ou `fixed_cents` | |
| `discountValue` | Inteiro positivo | Ver convenção abaixo |
| `maxUses` | Inteiro positivo ou `null` | `null` = ilimitado |
| `usedCount` | Inteiro | Nunca negativo, nunca acima de `maxUses` |
| `expiresAt` | `timestamptz` | No futuro ao criar |
| `isActive` | Booleano | Nasce `true` |

| Order | Tipo | Regra |
| --- | --- | --- |
| `customerId` | FK `users` | Sempre o usuário autenticado |
| `eventId` | FK `events` | |
| `couponId` | FK `coupons`, nulo | |
| `status` | `pending`, `paid`, `cancelled`, `expired` | Nasce `pending` |
| `subtotalCents` / `discountCents` / `totalCents` | Inteiros | `total = subtotal - desconto`, nunca negativo |
| `idempotencyKey` | UUID v4 | Único por cliente |
| `requestHash` | SHA-256 do corpo | Detecta a mesma chave usada com outro conteúdo |
| `expiresAt` | `timestamptz` | Criação + 15 minutos |
| `paidAt` | `timestamptz`, nulo | Preenchido se, e só se, `status = paid` |

| OrderItem | Tipo | Regra |
| --- | --- | --- |
| `batchId` | FK `ticket_batches` | Um lote aparece uma vez por pedido |
| `quantity` | Inteiro positivo | |
| `unitPriceCents` | Inteiro | **Snapshot** do preço do lote na compra |
| `totalPriceCents` | Inteiro | `quantity * unitPriceCents` |

O preço do item é copiado no momento da reserva. Se o organizador mudar o preço
do lote depois, os pedidos já feitos continuam com o valor que o cliente aceitou.

### Convenção de `discountValue`

| `discountType` | Unidade | Exemplos |
| --- | --- | --- |
| `percentage` | Pontos-base (1 = 0,01%) | `1500` = 15%, `250` = 2,5%, `10000` = 100% (máximo) |
| `fixed_cents` | Centavos | `5000` = R$ 50,00 |

Pontos-base permitem descontos fracionários (2,5%) sem sair do inteiro. O
percentual é arredondado **para baixo**: 15% de R$ 9,99 dá R$ 1,49, nunca R$ 1,50,
então o desconto nunca passa do anunciado. O desconto fixo é limitado ao
subtotal: um cupom de R$ 100 num pedido de R$ 50 zera o total, sem deixá-lo
negativo.

## Reserva: `POST /api/v1/orders`

```http
POST /api/v1/orders
Authorization: Bearer <access token de um customer>
Idempotency-Key: 3b241101-e2bb-4255-8caf-4136c566a962
Content-Type: application/json

{
  "eventId": "…",
  "items": [
    { "batchId": "…", "quantity": 2 },
    { "batchId": "…", "quantity": 1 }
  ],
  "couponCode": "verao15"
}
```

Tudo acontece numa única transação (`UnitOfWork` sobre `QueryRunner`):

1. **Limite por pedido.** Mais de 10 ingressos no total é recusado antes de
   tocar no banco (`ORDER_TICKET_LIMIT_EXCEEDED`), para dificultar a compra em
   massa por cambistas.
2. **Idempotência.** Um lock consultivo (`pg_advisory_xact_lock`) sobre
   cliente + chave serializa requisições repetidas. Se já existir pedido com a
   chave, ele é devolvido e nada mais roda.
3. **Lotes travados em ordem de id.** `SELECT ... FOR UPDATE ... ORDER BY id`.
   Todos devem existir (`404`) e pertencer ao evento informado (`422`).
4. **Evento à venda.** Publicado e com data futura, lido **depois** dos locks
   (ver abaixo por quê).
5. **Cada lote.** Janela de vendas aberta (`salesStartDate <= agora <=
   salesEndDate`) e estoque suficiente; `availableQuantity` é decrementado.
6. **Cupom, se houver.** Travado com `FOR UPDATE`, buscado pelo código **dentro
   do evento** (cupom de outro evento não existe aqui), validado (ativo, na
   validade, com uso livre) e `usedCount` incrementado.
7. **Pedido e itens** gravados, com `expiresAt` 15 minutos à frente.

Qualquer erro em qualquer etapa desfaz tudo: estoque, cupom e pedido. O teste
e2e pede 2 ingressos de um lote com estoque e 4 de um lote que só tem 3, e
confere que o primeiro lote não perdeu nada.

### Por que o estoque não fica negativo

O lock de linha (`FOR UPDATE`) faz pedidos que disputam o mesmo lote esperarem
a vez. Quem espera relê o lote **depois** que o anterior confirma, então sempre
vê o saldo atualizado. O teste e2e dispara 5 clientes ao mesmo tempo pelos 2
últimos ingressos de um lote: exatamente 2 pedidos `pending`, 3 respostas
`422 INSUFFICIENT_BATCH_STOCK` e saldo final 0. Além disso, o `CHECK`
`available_quantity >= 0` no banco barra qualquer caminho que escape do domínio.

### Por que o status do evento é lido depois dos locks

Cancelar o evento (organizador) também trava os lotes dele. Se a compra lesse o
status antes de travar os lotes, poderia ver "publicado", esperar o
cancelamento terminar e vender ingresso de evento cancelado. Lendo depois, ou o
cancelamento ainda não começou (e espera a compra), ou já terminou (e a compra
vê `cancelled`).

### Prevenção de deadlock: ordem global de locks

Deadlock acontece quando duas transações travam os mesmos recursos em ordens
opostas. Toda operação do sistema segue a mesma sequência:

| Operação | Ordem dos locks |
| --- | --- |
| Reservar (`POST /orders`) | lotes (por id) → cupom |
| Cancelar pedido | pedido → lotes (por id) → cupom |
| Pagar pedido | pedido |
| Alterar evento ou lote (organizador) | evento → lotes (por id) |

Lotes sempre por id, cupom sempre depois dos lotes. Ajustar o evento passou a
travar os lotes por id (antes era por data de criação), exatamente para não
cruzar com a ordem da venda.

## Idempotência

O cabeçalho `Idempotency-Key` (UUID v4) é **obrigatório** em `POST /orders`.
O cliente gera uma chave por intenção de compra e a reenvia em qualquer
repetição (timeout de rede, duplo clique, retry automático).

| Situação | Resposta |
| --- | --- |
| Chave nova | `201` com o pedido criado |
| Mesma chave, mesmo conteúdo | `200` com o **mesmo** pedido e `Idempotent-Replayed: true`; nada é reservado de novo |
| Mesma chave, conteúdo diferente | `409 IDEMPOTENCY_KEY_REUSED` |
| Mesma chave de outro cliente | Pedido independente (a chave é única por cliente) |
| Tentativa anterior falhou (422) | A chave não gerou pedido, então pode ser reutilizada |

"Mesmo conteúdo" ignora a ordem dos itens e a caixa do cupom: o hash é
calculado sobre uma forma canônica do corpo.

Duas camadas de proteção contra o duplo clique simultâneo:

1. **Lock consultivo** por cliente + chave: a segunda requisição espera a
   primeira terminar e então encontra o pedido dela. Sem ele, a segunda poderia
   receber `422 INSUFFICIENT_BATCH_STOCK` por disputar os últimos ingressos com
   a própria primeira tentativa.
2. **Índice único** `(customer_id, idempotency_key)` como rede de segurança: se
   duas gravações escaparem, a segunda falha, é desfeita (estoque devolvido) e
   responde com o pedido vencedor.

## Ciclo de vida do pedido

```text
pending ──pay──> paid
   │
   └──cancel──> cancelled   (devolve estoque e uso do cupom)
```

| Ação | Quem | Regras |
| --- | --- | --- |
| `POST /orders/:id/pay` | Só o comprador | Pedido `pending` e `agora <= expiresAt`; depois disso, `422 ORDER_EXPIRED` |
| `POST /orders/:id/cancel` | Comprador ou `admin` | Pedido `pending`, vencido ou não |
| `GET /orders/:id` | Comprador ou `admin` | |
| `GET /orders/me` | Autenticado | Paginado, filtro opcional por `status` |

O pagamento é uma **simulação** do retorno do gateway; na Sessão 5 é este ponto
que vai enfileirar no BullMQ a emissão dos ingressos. O pedido fica travado
durante o pagamento e o cancelamento, então os dois nunca acontecem ao mesmo
tempo.

O cancelamento roda numa só transação: muda o status, devolve
`availableQuantity` a cada lote e decrementa o `usedCount` do cupom.

### Reservas vencidas

Pedido `pending` com `expiresAt` no passado não pode mais ser pago, mas ainda
segura o estoque até ser cancelado. A liberação automática (passar para
`expired` e devolver o estoque) é um job agendado da Sessão 5, apoiado no índice
`IDX_orders_status_expires_at (status, expires_at)`.

## Cupons: gestão

| Rota | Acesso |
| --- | --- |
| `POST /api/v1/events/:eventId/coupons` | Dono do evento ou `admin` |
| `GET /api/v1/events/:eventId/coupons` | Dono do evento ou `admin` |

Só eventos em rascunho ou publicados aceitam cupons novos. A listagem mostra
`usedCount`, para o organizador acompanhar o uso.

## Visão do organizador: `GET /api/v1/events/me`

Lista, paginados, os eventos criados pelo usuário autenticado (`organizer` ou
`admin`) em qualquer status, com filtro opcional `status`. Eventos removidos
ficam de fora. Ordem: mais recentes primeiro.

## Códigos de erro

| HTTP | `error` | Quando |
| --- | --- | --- |
| 400 | `Bad Request` | Corpo inválido, lote repetido nos itens, `Idempotency-Key` ausente ou fora do formato |
| 400 | `INVALID_EVENT_DATA` | Cupom com valor fora da convenção (percentual acima de 10000, por exemplo) |
| 403 | `Forbidden` | Papel sem permissão (organizador comprando, cliente criando cupom) |
| 403 | `ORDER_ACCESS_DENIED` | Pedido de outro cliente |
| 403 | `EVENT_ACCESS_DENIED` | Cupom de evento de outro organizador |
| 404 | `ORDER_NOT_FOUND` | Pedido inexistente |
| 404 | `EVENT_NOT_FOUND` / `TICKET_BATCH_NOT_FOUND` | Evento ou lote inexistente |
| 409 | `IDEMPOTENCY_KEY_REUSED` | Mesma chave com outro conteúdo |
| 409 | `COUPON_CODE_ALREADY_EXISTS` | Código já usado no evento |
| 422 | `EVENT_NOT_ON_SALE` | Evento não publicado ou já realizado |
| 422 | `BATCH_EVENT_MISMATCH` | Lote de outro evento no pedido |
| 422 | `BATCH_SALES_CLOSED` | Fora da janela de vendas do lote |
| 422 | `INSUFFICIENT_BATCH_STOCK` | Estoque menor que o pedido |
| 422 | `ORDER_TICKET_LIMIT_EXCEEDED` | Mais de 10 ingressos no pedido |
| 422 | `COUPON_NOT_FOUND` | Código inexistente neste evento |
| 422 | `COUPON_INACTIVE` / `COUPON_EXPIRED` / `COUPON_EXHAUSTED` | Cupom desativado, vencido ou sem usos |
| 422 | `ORDER_EXPIRED` | Pagamento depois dos 15 minutos |
| 422 | `INVALID_ORDER_STATUS` | Pagar ou cancelar pedido que não está pendente |

Referência a recurso no **caminho** inexistente dá `404`. Problema com um dado
do **corpo** que existe mas não serve (cupom vencido, lote de outro evento) dá
`422`.

## Testando à mão

[`docs/requests/pedidos.http`](requests/pedidos.http) percorre o fluxo em
ordem: cupons, reserva, idempotência, estoque esgotado, limite por pedido, cupom
esgotado, cancelamento devolvendo estoque, pagamento e prazo expirado.

A disputa simultânea fica no teste automatizado:

```bash
npx vitest run --config ./vitest.config.e2e.ts test/orders.e2e-spec.ts -t "concorrência"
```
