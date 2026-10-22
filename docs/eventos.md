# Eventos e lotes de ingressos

Como eventos e lotes são modelados, que regras protegem a capacidade e o estoque,
e como a API garante essas regras sob concorrência.

## Modelo

`Event` é a raiz do agregado e `TicketBatch` (lote) pertence a ele. Toda
alteração em lote passa pelo evento, porque a regra mais importante, "a soma dos
lotes não passa da capacidade", envolve todos os lotes ao mesmo tempo.

| Event | Tipo | Observação |
| --- | --- | --- |
| `id` | UUID | Gerado pelo domínio |
| `title` | 3 a 160 caracteres | |
| `slug` | Único, indexado | Derivado do título na criação, com sufixo do id; não muda depois |
| `description` | Até 5000 caracteres | |
| `venue` | 2 a 200 caracteres | Local |
| `eventDate` | `timestamptz` | Sempre no futuro ao criar, alterar ou publicar |
| `maxCapacity` | Inteiro, 1 a 1.000.000 | |
| `status` | `draft`, `published`, `cancelled`, `finished` | Nasce `draft` |
| `organizerId` | FK para `users` | Sempre o usuário autenticado que criou |
| `deletedAt` | Soft delete | Preenchido na remoção |

| TicketBatch | Tipo | Observação |
| --- | --- | --- |
| `name` | 1 a 100 caracteres | Ex.: "1º Lote - Meia-entrada" |
| `unitPriceCents` | Inteiro, 0 a 100.000.000 | Centavos: `15000` = R$ 150,00 |
| `totalQuantity` | Inteiro positivo | |
| `availableQuantity` | Inteiro, 0 a `totalQuantity` | Nasce igual ao total |
| `salesStartDate` / `salesEndDate` | `timestamptz` | Início antes do fim; fim até a data do evento |
| `version` | `@VersionColumn` | Incrementada a cada `UPDATE` do lote |

### Por que preço em centavos (`integer`) e não `numeric(10,2)`

As duas opções guardam o valor exato no banco. A diferença está no caminho até o
código:

- O driver `pg` devolve `numeric` como **string** (`"150.00"`), justamente para
  não perder precisão. Para somar, aplicar desconto ou calcular taxa, o código
  teria de converter para `number` (e cair de volta no ponto flutuante:
  `0.1 + 0.2 = 0.30000000000000004`) ou adotar uma biblioteca decimal em todo
  cálculo.
- Centavos em `integer` chegam como `number` inteiro, e soma, subtração e
  multiplicação por quantidade são exatas até 2^53. Não há arredondamento
  escondido nem dependência extra.
- O teto de `integer` no PostgreSQL (R$ 21,4 milhões) fica muito acima do limite
  de R$ 1.000.000,00 por ingresso.

A moeda é BRL. A formatação (`R$ 150,00`) é responsabilidade do cliente.

## Regras de negócio

| Regra | Onde é garantida | Erro |
| --- | --- | --- |
| Só `organizer` e `admin` criam eventos | `@Roles()` e a política de acesso do caso de uso | `403` |
| Organizador só gerencia evento que criou; admin gerencia qualquer um | `assertCanManage` em todo caso de uso de gestão | `403 EVENT_ACCESS_DENIED` |
| Soma de `totalQuantity` dos lotes ≤ `maxCapacity` | `Event` (criar, adicionar, alterar lote, reduzir capacidade) | `422 EVENT_CAPACITY_EXCEEDED` |
| `eventDate` no futuro | DTO (`@IsFutureDate`) e `Event` | `400` / `422 INVALID_EVENT_SCHEDULE` |
| `salesStartDate` < `salesEndDate` | DTO (`@IsAfterProperty`), `TicketBatch` e `CHECK` no banco | `400` / `422 INVALID_EVENT_SCHEDULE` |
| `salesEndDate` ≤ `eventDate` | `Event` (inclusive ao antecipar o evento) | `422 INVALID_EVENT_SCHEDULE` |
| `totalQuantity` nunca abaixo do já vendido | `TicketBatch.update` | `422 TICKET_BATCH_QUANTITY_BELOW_SOLD` |
| Publicar exige rascunho, ao menos um lote e data futura | `Event.publish` | `422 INVALID_STATUS_TRANSITION` / `EVENT_WITHOUT_BATCHES` |
| Cancelado ou finalizado não aceita alteração | `Event` | `422 EVENT_NOT_EDITABLE` |
| Remover só rascunho ou cancelado | `Event.remove` | `422 INVALID_STATUS_TRANSITION` |

**400 ou 422?** `400` é entrada malformada, barrada no DTO antes de chegar ao
domínio (tipo errado, campo desconhecido, data inválida). `422` é entrada bem
formada que viola uma regra de negócio, decidida pelo domínio com o estado atual
do evento.

As datas são validadas nas duas camadas por motivos diferentes. O DTO compara
datas do mesmo corpo e recusa cedo. O domínio é a fonte da verdade: num `PATCH`
parcial só ele conhece a data do evento e as datas já gravadas do lote.

### Estoque vendido

Ao alterar `totalQuantity`, o que já foi vendido (`total - disponível`) é
preservado e só a parte disponível acompanha a mudança:

| Antes (total / disponível) | Novo total | Depois (total / disponível) |
| --- | --- | --- |
| 100 / 70 (30 vendidos) | 150 | 150 / 120 |
| 100 / 70 (30 vendidos) | 30 | 30 / 0 |
| 100 / 70 (30 vendidos) | 29 | Recusado: `422` |

### Ciclo de vida

```text
draft ──publish──> published ──cancel──> cancelled ──remove──> (soft delete)
  │                                          ▲
  ├──────────────cancel──────────────────────┘
  └──remove──> (soft delete)
```

`finished` existe no modelo e bloqueia alterações, mas ainda não há transição
automática para ele (fica para quando houver um job agendado).

## Concorrência e transações

### Criação: transação ACID

`POST /events` aceita `initialBatches`. O domínio valida evento e lotes por
completo antes de qualquer escrita. Depois, `TypeOrmEventRepository.create`
grava o evento e os lotes numa única transação: se o `INSERT` dos lotes falhar
(constraint, conexão, qualquer erro), o `INSERT` do evento é desfeito. O teste
e2e força essa falha (lote com PK duplicada) e confere que o evento não fica no
banco.

### Alterações: lock pessimista no agregado

Duas requisições simultâneas adicionando lotes ao mesmo evento poderiam, cada
uma, ler a soma antiga, passar na checagem e juntas estourar a capacidade. Por
isso toda alteração usa `EventRepository.update(id, change)`:

1. Abre transação e lê o evento e os lotes com `SELECT ... FOR UPDATE`.
2. Aplica `change` no domínio (regras e ownership).
3. Grava só o que mudou: lotes novos com `INSERT`, alterados com `UPDATE`.
4. Commit. Qualquer erro no caminho desfaz tudo.

A segunda requisição espera o lock da primeira e lê a soma já atualizada. O
teste e2e dispara três lotes de 60 em paralelo num evento de capacidade 100 e
confere que exatamente um entra.

O lock é aceitável aqui porque gestão de evento é operação rara, feita pelo
organizador. A venda, que é o caminho quente, não vai travar o evento: vai
decrementar `available_quantity` do lote com uma escrita atômica condicionada ao
estoque, e a `version` de cada lote permite detectar escrita concorrente.

### Leitura: CQRS leve

Escrita e leitura usam portas diferentes:

- `EventRepository` (domínio) carrega e grava o agregado inteiro.
- `EventCatalog` (aplicação) devolve read models prontos para o catálogo
  público, sem carregar lotes na listagem e sem lock.

## Catálogo público

`GET /api/v1/events` lista somente eventos publicados e não removidos, ordenados
pela data do evento.

| Parâmetro | Padrão | Regra |
| --- | --- | --- |
| `page` | `1` | Inteiro de 1 a 10.000 |
| `limit` | `20` | Inteiro de 1 a 100 |
| `search` | | Até 100 caracteres; procura no título e no local, sem diferenciar caixa |
| `from` | Agora | Data ISO 8601; sem ela, só eventos futuros |
| `to` | | Data ISO 8601, igual ou posterior a `from` |

```json
{
  "data": [
    {
      "id": "0b6f3c1e-8f0a-4c55-9a59-3f1f0c2d7e11",
      "slug": "festival-de-verao-2027-0b6f3c1e",
      "title": "Festival de Verão 2027",
      "venue": "Allianz Parque, São Paulo - SP",
      "eventDate": "2027-03-15T20:00:00.000Z",
      "status": "published"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "totalItems": 1,
    "totalPages": 1,
    "hasNextPage": false,
    "hasPreviousPage": false
  }
}
```

O termo de busca é tratado como texto literal: `%` e `_` são escapados e não
viram curingas do `LIKE`. Os índices trigram GIN em `title` e `venue` fazem
`ILIKE '%termo%'` usar índice em vez de varrer a tabela.

`GET /api/v1/events/:slug` devolve o detalhe com os lotes. Evento em rascunho,
cancelado ou removido responde `404`, como se não existisse.

## Rotas

| Rota | Acesso | Sucesso |
| --- | --- | --- |
| `GET /api/v1/events` | Pública | `200` página de eventos publicados |
| `GET /api/v1/events/:slug` | Pública | `200` detalhe com lotes |
| `POST /api/v1/events` | `organizer`, `admin` | `201` evento em rascunho |
| `PATCH /api/v1/events/:id` | Dono ou `admin` | `200` |
| `POST /api/v1/events/:id/publish` | Dono ou `admin` | `200` |
| `POST /api/v1/events/:id/cancel` | Dono ou `admin` | `200` |
| `DELETE /api/v1/events/:id` | Dono ou `admin` | `204` soft delete |
| `POST /api/v1/events/:id/batches` | Dono ou `admin` | `201` lote criado |
| `PATCH /api/v1/events/:id/batches/:batchId` | Dono ou `admin` | `200` |

## Códigos de erro

| HTTP | `error` | Quando |
| --- | --- | --- |
| 400 | `Bad Request` | DTO inválido (tipo, campo desconhecido, data mal formada, período invertido) |
| 401 | `INVALID_TOKEN` | Rota de gestão sem token válido |
| 403 | `Forbidden` | Papel sem permissão (`customer` criando evento) |
| 403 | `EVENT_ACCESS_DENIED` | Organizador mexendo em evento de outro |
| 404 | `EVENT_NOT_FOUND` | Evento inexistente, removido ou não publicado (na rota pública) |
| 404 | `TICKET_BATCH_NOT_FOUND` | Lote inexistente ou de outro evento |
| 422 | `EVENT_CAPACITY_EXCEEDED` | Soma dos lotes acima de `maxCapacity` |
| 422 | `INVALID_EVENT_SCHEDULE` | Data do evento no passado ou vendas fora do período |
| 422 | `TICKET_BATCH_QUANTITY_BELOW_SOLD` | Total do lote abaixo do já vendido |
| 422 | `EVENT_NOT_EDITABLE` | Alteração em evento cancelado ou finalizado |
| 422 | `INVALID_STATUS_TRANSITION` | Publicar fora do rascunho, remover publicado etc. |
| 422 | `EVENT_WITHOUT_BATCHES` | Publicar sem lotes |

## Testando à mão

[`docs/requests/eventos.http`](requests/eventos.http) percorre todas as travas
na ordem (papéis, ownership, capacidade, datas, estoque, catálogo e ciclo de
vida), com a resposta esperada acima de cada requisição. Abra no VS Code com a
extensão REST Client. O próprio arquivo traz os dois comandos SQL necessários:
promover papéis e simular vendas.

Equivalente em cURL para a listagem pública:

```bash
curl "http://localhost:3000/api/v1/events?page=1&limit=10&search=festival"
```
