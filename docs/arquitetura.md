# Arquitetura

O TicketForge segue Clean Architecture organizada por módulo (bounded context).
Cada módulo de negócio tem as próprias quatro camadas, e o que é transversal ao
framework fica em `core/`.

## Árvore de diretórios

Pastas marcadas com `(futuro)` ainda não existem: são criadas quando o primeiro
código que pertence a elas chegar, para não versionar diretórios vazios.

```text
ticket-forge/
├── docker-compose.yml             # PostgreSQL e Redis locais
├── .env.example                   # contrato de configuração documentado
├── docs/
├── test/                          # testes e2e (*.e2e-spec.ts)
└── src/
    ├── main.ts                    # bootstrap HTTP
    ├── app.module.ts              # raiz de composição: módulos e filtro global
    │
    ├── core/                      # infraestrutura transversal, sem regra de negócio
    │   ├── config/                # schema Zod, validação e EnvService tipado
    │   ├── database/              # opções do TypeORM, DataSource da CLI
    │   │   └── migrations/        # migrations versionadas
    │   ├── redis/                 # cliente ioredis global e encerramento limpo
    │   ├── health/                # health check (PostgreSQL e Redis)
    │   └── http/                  # Helmet, CORS, pipes, versionamento, Swagger
    │
    ├── shared/                    # blocos reutilizáveis entre módulos
    │   ├── domain/
    │   │   └── errors/            # DomainError: base de todo erro de negócio
    │   ├── application/
    │   │   ├── pagination.ts      # PageRequest, Page<T>
    │   │   └── unit-of-work.ts    # UnitOfWork: transação que atravessa módulos
    │   ├── infrastructure/
    │   │   └── persistence/typeorm/
    │   │       ├── typeorm-unit-of-work.ts  # QueryRunner + AsyncLocalStorage, TransactionContext
    │   │       └── postgres-errors.ts       # isUniqueViolation()
    │   └── presentation/
    │       └── http/
    │           ├── decorators/    # @Public(), @IdempotencyKey()
    │           ├── filters/       # DomainError -> status HTTP
    │           ├── validators/    # @IsAfterProperty(), @IsFutureDate()
    │           ├── pagination.ts  # PaginationQuery, PaginationMetaResponse
    │           └── error.response.ts
    │
    └── modules/
        ├── users/                 # identidade e credenciais
        │   ├── domain/
        │   │   ├── entities/      # User
        │   │   ├── value-objects/ # Email, UserRole
        │   │   ├── errors/
        │   │   └── repositories/  # UserRepository (porta)
        │   ├── application/
        │   │   ├── ports/         # PasswordHasher
        │   │   ├── dtos/          # UserView
        │   │   └── use-cases/     # CreateUser, VerifyCredentials, GetUserProfile
        │   ├── infrastructure/
        │   │   ├── crypto/        # ScryptPasswordHasher
        │   │   └── persistence/typeorm/
        │   │       ├── entities/      # UserOrmEntity
        │   │       ├── mappers/       # UserMapper
        │   │       └── repositories/  # TypeOrmUserRepository
        │   ├── presentation/http/ # UsersController e DTOs de resposta
        │   ├── testing/           # dublês para testes, fora do build
        │   └── users.module.ts
        │
        ├── events/                # eventos, lotes, estoque e cupons
        │   ├── domain/
        │   │   ├── entities/      # Event (raiz do agregado), TicketBatch, Coupon
        │   │   ├── value-objects/ # Slug, EventStatus, DiscountType
        │   │   ├── errors/
        │   │   └── repositories/  # EventRepository, TicketStockRepository, CouponRepository
        │   ├── application/
        │   │   ├── ports/         # EventCatalog (leitura)
        │   │   ├── policies/      # ownership: quem gerencia qual evento
        │   │   ├── services/      # TicketInventoryService (API pública para vendas)
        │   │   ├── dtos/          # views de evento, lote e cupom
        │   │   ├── errors/
        │   │   └── use-cases/     # gestão de eventos e lotes, ListMyEvents, Create/ListCoupons
        │   ├── infrastructure/persistence/typeorm/
        │   │   ├── entities/      # EventOrmEntity, TicketBatchOrmEntity, CouponOrmEntity
        │   │   ├── mappers/       # EventMapper, TicketBatchMapper
        │   │   ├── repositories/  # evento (transação + lock), estoque e cupons
        │   │   └── queries/       # TypeOrmEventCatalog
        │   ├── presentation/http/ # EventsController, EventCouponsController, DTOs
        │   ├── testing/
        │   └── events.module.ts
        │
        ├── orders/                # reserva, checkout e cancelamento
        │   ├── domain/
        │   │   ├── entities/      # Order, OrderItem
        │   │   ├── value-objects/ # OrderStatus
        │   │   ├── errors/
        │   │   └── repositories/  # OrderRepository
        │   ├── application/
        │   │   ├── ports/         # OrderQueries (leitura)
        │   │   ├── policies/      # quem compra, consulta, paga e cancela
        │   │   ├── dtos/          # OrderView
        │   │   ├── errors/
        │   │   └── use-cases/     # PlaceOrder, PayOrder, CancelOrder, GetOrder, ListMyOrders
        │   ├── infrastructure/persistence/typeorm/
        │   │   ├── entities/      # OrderOrmEntity, OrderItemOrmEntity
        │   │   ├── mappers/
        │   │   ├── repositories/  # TypeOrmOrderRepository (lock consultivo + FOR UPDATE)
        │   │   └── queries/       # TypeOrmOrderQueries
        │   ├── presentation/http/ # OrdersController e DTOs
        │   ├── testing/
        │   └── orders.module.ts
        │
        └── auth/                  # sessão, tokens e controle de acesso
            ├── application/
            │   ├── ports/         # TokenService, SessionStore
            │   ├── services/      # SessionTokenIssuer
            │   ├── errors/
            │   ├── dtos/          # AuthenticatedUser, AuthTokens
            │   └── use-cases/     # Register, Login, RefreshToken, Logout, ValidateAccessToken
            ├── infrastructure/
            │   ├── jwt/           # JwtTokenService
            │   └── redis/         # RedisSessionStore
            ├── presentation/http/
            │   ├── controllers/   # AuthController
            │   ├── decorators/    # @Roles(), @CurrentUser()
            │   ├── guards/        # JwtAuthGuard, RolesGuard (globais)
            │   └── dtos/
            ├── testing/
            └── auth.module.ts
```

O módulo `auth` não tem camada `domain`: não guarda estado de negócio próprio.
Sessão é um registro técnico de infraestrutura, e as regras de identidade vivem
em `users`.

## Responsabilidade de cada camada

### `domain`

O coração do módulo: entidades, value objects, eventos e erros de domínio, além
das **interfaces** dos repositórios. Aqui ficam as invariantes, como "todo
cadastro nasce `customer`" ou "um e-mail só existe normalizado".

Não importa `@nestjs/*`, `typeorm`, `class-validator` nem nada de
infraestrutura. É TypeScript puro e testável sem subir nada.

### `application`

Os casos de uso: orquestram o domínio para cumprir uma intenção do usuário
(cadastrar, autenticar, renovar sessão). Declaram as portas de que precisam
(`PasswordHasher`, `TokenService`, `SessionStore`), sem saber quem as implementa.

Depende apenas de `domain` e de `shared`. Usa `@Injectable()` para participar da
injeção de dependência, mas não conhece HTTP, SQL ou Redis.

### `infrastructure`

Os adaptadores que implementam as portas: repositórios TypeORM, mapeadores entre
entidade de domínio e entidade ORM, hasher de senha, emissor de JWT e store de
sessão no Redis. É a única camada que sabe que existem PostgreSQL e Redis.

As entidades ORM ficam separadas das entidades de domínio. Isso permite mudar o
modelo relacional (índices, constraints, colunas de versão) sem tocar na regra
de negócio, e vice-versa.

### `presentation`

A borda HTTP: controllers, DTOs de request e response com `class-validator` e
decorators do Swagger, guards e decorators de rota. Converte a requisição em
entrada de caso de uso e o resultado em resposta. Não contém regra de negócio.

### `core`

Infraestrutura de framework compartilhada pela aplicação inteira: configuração,
conexões com PostgreSQL e Redis, bootstrap HTTP e health check. Muda quando o
framework muda, não quando o negócio muda.

### `shared`

Abstrações genéricas usadas por vários módulos, organizadas nas mesmas quatro
camadas e sujeitas à mesma regra de dependência. Entra aqui o que já tem dois ou
mais consumidores reais, como `DomainError` (todos os módulos) e `@Public()`
(`auth`, `events` e `core/health`), ou o que define um padrão da API inteira,
como o formato de paginação e os validadores de data dos DTOs.

## Regra de dependência

```text
presentation ──> application ──> domain
                     ▲
infrastructure ──────┘ (implementa as portas declaradas em application e domain)
```

- As setas apontam sempre para dentro. `domain` não depende de ninguém.
- `infrastructure` e `presentation` não se conhecem.
- Portas são classes abstratas: servem de contrato e de token de injeção ao
  mesmo tempo, sem `Symbol` nem `@Inject()` extra.
- O `<modulo>.module.ts` é a raiz de composição do módulo: é o único lugar que
  liga uma porta ao seu adaptador (`{ provide: UserRepository, useClass: TypeOrmUserRepository }`).

## Comunicação entre módulos

Um módulo nunca acessa o repositório, a entidade ORM ou as tabelas de outro. O
que pode atravessar a fronteira:

| De | Para | O quê | Exemplo |
| --- | --- | --- | --- |
| `application` | `application` de outro módulo | Casos de uso e serviços exportados pelo `*.module.ts` | `LoginUseCase` chama `VerifyCredentialsUseCase`; `PlaceOrderUseCase` chama `TicketInventoryService` |
| Qualquer camada | `domain` de outro módulo | Value objects e enums de linguagem compartilhada | `UserRole` no token e no `@Roles()` |
| `presentation` | `auth/presentation` | Decorators de controle de acesso | `@Roles()` e `@CurrentUser()` em `UsersController` e `EventsController` |
| `infrastructure` | Tabela de outro módulo | Somente chave estrangeira, declarada pelo nome da entidade | `@ManyToOne('UserOrmEntity')` em `EventOrmEntity` |

Os casos de uso exportados devolvem read models (`UserView`), nunca a entidade
de domínio: o chamador não consegue alterar um `User` de outro módulo.

`events` guarda apenas o `organizerId` do dono, sem importar nada de `users`
além do enum `UserRole`. A FK para `users` existe no banco, mas é declarada pelo
nome da entidade (`'UserOrmEntity'`), sem import da infraestrutura do outro
módulo.

Grafo de dependência entre módulos Nest, sempre de mão única:

```text
AuthModule ──> UsersModule
OrdersModule ──> EventsModule
```

`orders` não lê nem grava as tabelas de lotes e cupons: pede ao
`TicketInventoryService` de `events` que reserve ou devolva estoque.

## Transações que atravessam módulos

A reserva de um pedido precisa baixar o estoque (tabelas de `events`) e gravar o
pedido (tabelas de `orders`) atomicamente. O `UnitOfWork` resolve isso sem
quebrar a fronteira:

```ts
// orders/application: o caso de uso delimita a transação
await this.unitOfWork.run(async () => {
  const reservation = await this.inventory.reserve(...); // escreve em ticket_batches e coupons
  await this.orders.create(order);                        // escreve em orders e order_items
});
```

| Peça | Camada | Papel |
| --- | --- | --- |
| `UnitOfWork` | `shared/application` | Porta: `run(work)` executa `work` numa transação |
| `TypeOrmUnitOfWork` | `shared/infrastructure` | Abre um `QueryRunner`, guarda o `EntityManager` num `AsyncLocalStorage` e faz commit ou rollback |
| `TransactionContext` | `shared/infrastructure` | Entrega aos repositórios o manager da transação em curso; `transactionalManager` exige transação ativa |

Cada repositório continua escrevendo só nas próprias tabelas; todos usam o
manager da mesma transação. `run` aninhado reaproveita a transação externa, então
o `TicketInventoryService` funciona tanto sozinho quanto dentro do pedido.

## Escrita e leitura separadas

Quando a leitura tem forma diferente da escrita, o módulo usa duas portas (CQRS
leve, no mesmo banco):

| Porta | Camada | Uso |
| --- | --- | --- |
| `EventRepository` | `domain` | Carrega e grava o agregado inteiro, com as regras e sob lock |
| `EventCatalog` | `application` | Devolve read models paginados para o catálogo público, sem carregar o agregado |
| `OrderRepository` / `OrderQueries` | `domain` / `application` | O mesmo padrão para pedidos |

O repositório de escrita expõe `update(id, change)`: carrega com
`SELECT ... FOR UPDATE`, aplica a função no domínio e grava na mesma transação.
O caso de uso diz o que mudar; a infraestrutura cuida de transação e lock. Ver
[Eventos](eventos.md#concorrência-e-transações).

A dependência entre módulos Nest é de mão única: `AuthModule` importa
`UsersModule`, nunca o contrário. Os decorators de acesso são só metadados e os
guards são globais (`APP_GUARD`), então `users` usa `@Roles()` sem importar o
`AuthModule`.

## Convenções

| Item | Convenção |
| --- | --- |
| Imports relativos | Com extensão `.js`, exigido pelo ESM em `nodenext` |
| Entidade ORM | `*.orm-entity.ts` em `modules/<m>/infrastructure/persistence/` |
| Registro de entidade | `TypeOrmModule.forFeature([...])` no módulo dono |
| Nomes de constraint | Explícitos (`PK_users`, `UQ_users_email`), nunca hash gerado |
| Migration | `src/core/database/migrations/<timestamp>-<Nome>.ts` |
| Erro de negócio | Subclasse de `DomainError` com `kind` e `code` estável |
| `kind` do erro | `validation` -> 400, `business_rule` -> 422, `conflict` -> 409, `not_found` -> 404, `unauthorized` -> 401, `forbidden` -> 403 |
| Dinheiro | Inteiro em centavos, com sufixo `Cents` no nome (`unitPriceCents`) |
| Paginação | `PaginationQuery` na entrada e `{ data, meta }` na saída |
| Relógio | O domínio recebe `now` por parâmetro; o caso de uso passa `new Date()` |
| Teste unitário | `*.spec.ts` ao lado do arquivo testado |
| Dublês de teste | `<modulo>/testing/`, excluídos do build de produção |
| Teste e2e | `test/*.e2e-spec.ts` |
| Rotas | Versionadas por URI (`/api/v1/...`); health é neutro de versão |
| Acesso | Toda rota é protegida; abrir exige `@Public()` explícito |
| Ownership | Checado no caso de uso (`policies/`), não só no controller |
| Ordem de locks | Evento ou pedido → lotes (por id) → cupom, em toda operação |
| Rotas fixas e com parâmetro | `me` declarada antes de `:id`/`:slug` no controller |
| Filtros opcionais no TypeORM | Montados só quando informados: o TypeORM 1.x recusa `undefined` no `where` |
