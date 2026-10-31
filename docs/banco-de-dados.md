# Banco de dados

PostgreSQL 18 acessado pelo TypeORM 1.x. O schema muda **somente** por
migration: `synchronize` e `migrationsRun` estão desligados em todos os ambientes.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| [`typeorm-options.factory.ts`](../src/core/database/typeorm-options.factory.ts) | Fonte única das opções de conexão, usada pelo runtime e pela CLI |
| [`database.module.ts`](../src/core/database/database.module.ts) | Conexão assíncrona do Nest, alimentada pelo `EnvService` |
| [`data-source.ts`](../src/core/database/data-source.ts) | `DataSource` carregado apenas pela CLI do TypeORM |

## Tabelas

### `users`

Criada pela migration `CreateUsers`, gerada a partir de
[`user.orm-entity.ts`](../src/modules/users/infrastructure/persistence/typeorm/entities/user.orm-entity.ts).

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `id` | `uuid` | Chave primária `PK_users`, gerada pelo domínio |
| `email` | `varchar(254)` | Índice único `UQ_users_email`; `CHECK` exige minúsculas |
| `password_hash` | `varchar(255)` | Hash scrypt no formato PHC |
| `role` | enum `user_role` | `admin`, `organizer` ou `customer` (padrão) |
| `created_at` | `timestamptz` | Padrão `now()` |
| `updated_at` | `timestamptz` | Padrão `now()` |

O e-mail é normalizado para minúsculas pelo value object `Email`. O `CHECK`
`CHK_users_email_lowercase` repete a regra no banco: se algum caminho futuro
gravar sem passar pelo domínio, o índice único continua impedindo duplicatas
por diferença de caixa.

Dois cadastros simultâneos do mesmo e-mail podem passar juntos pela checagem
prévia do caso de uso. Quem decide é o índice único: o segundo `INSERT` falha
com o código `23505`, que o repositório traduz para `EmailAlreadyInUseError`
(`409`). O teste e2e dispara três cadastros em paralelo e confere que só um vence.

### `events`

Criada pela migration `CreateEventsAndTicketBatches`. Regras de negócio em
[Eventos](eventos.md).

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `id` | `uuid` | Chave primária `PK_events` |
| `organizer_id` | `uuid` | FK `FK_events_organizer` para `users`, `ON DELETE RESTRICT` |
| `title` | `varchar(160)` | |
| `slug` | `varchar(100)` | Índice único `UQ_events_slug` |
| `description` | `text` | |
| `venue` | `varchar(200)` | |
| `event_date` | `timestamptz` | |
| `max_capacity` | `integer` | `CHECK` maior que zero |
| `status` | enum `event_status` | `draft` (padrão), `published`, `cancelled`, `finished` |
| `created_at` / `updated_at` | `timestamptz` | Padrão `now()` |
| `deleted_at` | `timestamptz` nulo | Soft delete (`@DeleteDateColumn`) |

`ON DELETE RESTRICT` impede apagar um usuário que organiza eventos: o histórico
de quem criou cada evento não se perde.

### `ticket_batches`

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `id` | `uuid` | Chave primária `PK_ticket_batches` |
| `event_id` | `uuid` | FK `FK_ticket_batches_event`, `ON DELETE CASCADE`; indexada |
| `name` | `varchar(100)` | |
| `unit_price_cents` | `integer` | `CHECK` maior ou igual a zero |
| `total_quantity` | `integer` | `CHECK` maior que zero |
| `available_quantity` | `integer` | `CHECK` entre 0 e `total_quantity` |
| `sales_start_date` / `sales_end_date` | `timestamptz` | `CHECK` início antes do fim |
| `version` | `integer` | `@VersionColumn`: começa em 1 e sobe a cada `UPDATE` |
| `created_at` / `updated_at` | `timestamptz` | Padrão `now()` |

Os `CHECK` repetem as regras do domínio que cabem numa linha só. Mesmo um
`UPDATE` manual ou um bug futuro não consegue gravar estoque negativo ou maior
que o total. A regra que envolve várias linhas (soma dos lotes até a capacidade)
fica no domínio, protegida pelo lock descrito em
[Eventos](eventos.md#concorrência-e-transações).

### Índices de `events`

| Índice | Definição | Atende |
| --- | --- | --- |
| `UQ_events_slug` | `UNIQUE (slug)` | Detalhe público por slug |
| `IDX_events_status_event_date` | `(status, event_date) WHERE deleted_at IS NULL` | Listagem pública: filtro por status, intervalo e ordenação por data |
| `IDX_events_title_trgm` | `GIN (title gin_trgm_ops)` | Busca `ILIKE '%termo%'` no título |
| `IDX_events_venue_trgm` | `GIN (venue gin_trgm_ops)` | Busca no local |
| `IDX_events_organizer_id` | `(organizer_id)` | Eventos de um organizador e a checagem da FK |

O índice de status e data é **parcial**: linhas removidas não entram nele, então
ele não cresce com o histórico de eventos apagados.

Os índices trigram dependem da extensão `pg_trgm` (incluída na imagem oficial do
PostgreSQL e confiável desde o PG 13, sem precisar de superusuário). O TypeORM
não gera índice GIN com operator class, então eles são escritos à mão na
migration e declarados na entidade com `@Index(nome, { synchronize: false })`.
Sem essa declaração, o próximo `migration:generate` tentaria apagá-los.

### `coupons`

Criada pela migration `CreateCouponsAndOrders`. Regras em [Pedidos](pedidos.md).

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `id` | `uuid` | Chave primária `PK_coupons` |
| `event_id` | `uuid` | FK `FK_coupons_event`, `ON DELETE CASCADE` |
| `code` | `varchar(32)` | Único por evento (`UQ_coupons_event_code`); `CHECK` exige maiúsculas |
| `discount_type` | enum `coupon_discount_type` | `percentage` ou `fixed_cents` |
| `discount_value` | `integer` | `CHECK` maior que zero; até 10000 se `percentage` |
| `max_uses` | `integer` nulo | `CHECK` nulo ou maior que zero |
| `used_count` | `integer` | Padrão 0; `CHECK` entre 0 e `max_uses` |
| `expires_at` | `timestamptz` | |
| `is_active` | `boolean` | Padrão `true` |
| `created_at` / `updated_at` | `timestamptz` | Padrão `now()` |

### `orders`

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `id` | `uuid` | Chave primária `PK_orders` |
| `customer_id` | `uuid` | FK `FK_orders_customer` para `users`, `RESTRICT` |
| `event_id` | `uuid` | FK `FK_orders_event` para `events`, `RESTRICT` |
| `coupon_id` | `uuid` nulo | FK `FK_orders_coupon` para `coupons`, `RESTRICT` |
| `status` | enum `order_status` | `pending` (padrão), `paid`, `cancelled`, `expired` |
| `subtotal_cents` / `discount_cents` / `total_cents` | `integer` | `CHECK`: não negativos, desconto até o subtotal, `total = subtotal - desconto` |
| `idempotency_key` | `uuid` | Único por cliente (`UQ_orders_customer_idempotency_key`) |
| `request_hash` | `char(64)` | SHA-256 do corpo da requisição |
| `expires_at` | `timestamptz` | Fim da reserva |
| `paid_at` | `timestamptz` nulo | `CHECK`: preenchido se, e só se, `status = 'paid'` |
| `created_at` / `updated_at` | `timestamptz` | Padrão `now()` |

As FKs `RESTRICT` preservam o histórico: não dá para apagar um usuário, um
evento ou um cupom que tenha pedidos. Por isso evento usa soft delete.

### `order_items`

| Coluna | Tipo | Regra |
| --- | --- | --- |
| `id` | `uuid` | Chave primária `PK_order_items` |
| `order_id` | `uuid` | FK `FK_order_items_order`, `ON DELETE CASCADE` |
| `batch_id` | `uuid` | FK `FK_order_items_batch` para `ticket_batches`, `RESTRICT` |
| `quantity` | `integer` | `CHECK` maior que zero |
| `unit_price_cents` | `integer` | `CHECK` maior ou igual a zero; snapshot do preço do lote |
| `total_price_cents` | `integer` | `CHECK` igual a `quantity * unit_price_cents` |

`UQ_order_items_order_batch (order_id, batch_id)` impede o mesmo lote duas vezes
no pedido e também serve às buscas por `order_id`.

### Índices de `orders`

| Índice | Definição | Atende |
| --- | --- | --- |
| `UQ_orders_customer_idempotency_key` | `UNIQUE (customer_id, idempotency_key)` | Busca do pedido por chave e rede de segurança contra duplicata |
| `IDX_orders_status_expires_at` | `(status, expires_at)` | Varredura de reservas vencidas: `status = 'pending' AND expires_at < now()` |
| `IDX_orders_customer_created_at` | `(customer_id, created_at)` | `GET /orders/me`, mais recentes primeiro |
| `IDX_orders_event_id` / `IDX_orders_coupon_id` | | Checagem das FKs e consultas por evento ou cupom |

## Locks e concorrência

| Lock | Onde | Para quê |
| --- | --- | --- |
| `SELECT ... FOR UPDATE` em `ticket_batches`, por id | Reserva, cancelamento de pedido, alteração de evento | Serializar quem mexe no mesmo estoque |
| `SELECT ... FOR UPDATE` em `coupons` | Reserva e cancelamento com cupom | `used_count` nunca passa de `max_uses` |
| `SELECT ... FOR UPDATE` em `orders` | Pagamento e cancelamento | Impedir pagar e cancelar ao mesmo tempo |
| `pg_advisory_xact_lock` | Reserva, por cliente + `Idempotency-Key` | Serializar repetições da mesma requisição |

A ordem dos locks é a mesma em todas as operações (pedido ou evento, depois
lotes por id, depois cupom), o que elimina deadlock entre elas. Detalhes em
[Pedidos](pedidos.md#prevenção-de-deadlock-ordem-global-de-locks).

## Runtime e CLI

Os dois usam `buildDataSourceOptions`, com uma diferença deliberada no
carregamento de entidades:

- **Runtime (Nest):** `autoLoadEntities: true`. Cada módulo registra as próprias
  entidades com `TypeOrmModule.forFeature`, e uma entidade só existe na conexão
  se o módulo dono estiver importado.
- **CLI:** glob `modules/**/infrastructure/persistence/**/*.orm-entity.js`. Por
  isso o sufixo `.orm-entity.ts` é obrigatório para entidades persistidas.

Dê nome explícito a toda constraint e índice (`primaryKeyConstraintName`,
`@Index('UQ_...')`, `@Check('CHK_...')`). Nomes gerados por hash tornam a
migration ilegível e impedem o repositório de reconhecer qual constraint falhou.

## Por que a CLI roda sobre o build

O projeto é ESM nativo e as entidades usam decorators com metadados, que o
carregamento direto de TypeScript pelo Node não suporta. Em vez de adicionar um
loader como `ts-node` ou `tsx`, os scripts de migration compilam com `nest build`
e apontam a CLI para `dist/core/database/data-source.js`. O build é o mesmo que
vai para produção, então a migration aplicada localmente é a mesma do deploy.

## Fluxo de trabalho

```bash
# 1. Crie ou altere uma entidade *.orm-entity.ts e registre-a no módulo.

# 2. Gere a migration a partir da diferença entre entidades e banco.
npm run migration:generate -- src/core/database/migrations/CreateEvents

# 3. Revise o SQL gerado. Ajuste índices, constraints e dados se necessário.

# 4. Aplique.
npm run migration:run

# Para uma migration escrita à mão (dados, extensões, funções):
npm run migration:create -- src/core/database/migrations/SeedVenues
```

| Comando | Descrição |
| --- | --- |
| `npm run migration:create -- src/core/database/migrations/<Nome>` | Cria uma migration vazia |
| `npm run migration:generate -- src/core/database/migrations/<Nome>` | Gera a migration a partir da diferença entre entidades e banco |
| `npm run migration:run` | Aplica as migrations pendentes |
| `npm run migration:revert` | Desfaz a última migration aplicada |
| `npm run migration:show` | Lista as migrations e o estado de cada uma |

Para conferir se entidades e banco estão em sincronia (útil antes de abrir PR):

```bash
npm run build && npx typeorm migration:generate --check -d dist/core/database/data-source.js src/core/database/migrations/Check
```

As migrations aplicadas ficam registradas na tabela `typeorm_migrations`. Cada
migration roda na **própria transação** (`migrationsTransactionMode: 'each'`):
se a terceira de cinco falhar, as duas primeiras continuam aplicadas e a
terceira é revertida por inteiro, sem deixar o schema pela metade.

## Pool e timeouts

| Opção | Origem | Efeito |
| --- | --- | --- |
| `poolSize` | `DATABASE_POOL_MAX` | Conexões simultâneas por instância da API |
| `connectTimeoutMS` | Fixo em 5 s | Desiste de abrir conexão com banco indisponível |
| `statement_timeout` | `DATABASE_STATEMENT_TIMEOUT_MS` | O PostgreSQL cancela queries mais longas que o limite |
| `idle_in_transaction_session_timeout` | `DATABASE_STATEMENT_TIMEOUT_MS` | O PostgreSQL encerra a sessão que abriu transação e parou de responder |

Em venda de alta concorrência, o risco principal não é a query lenta, e sim a
transação que trava uma linha de estoque (`SELECT ... FOR UPDATE`) e nunca
termina. Os dois timeouts garantem que o lock é liberado mesmo se a aplicação
travar no meio da transação.

Ao dimensionar `DATABASE_POOL_MAX`, considere o total: instâncias da API vezes o
pool de cada uma precisa caber no `max_connections` do PostgreSQL (100 por padrão).

## TLS

Com `DATABASE_SSL=true`, a conexão exige TLS e valida o certificado do servidor
(`rejectUnauthorized: true`). Não há modo "TLS sem verificação": ele protegeria
contra escuta passiva, mas não contra um servidor falso.
