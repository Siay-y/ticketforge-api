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
    ├── app.module.ts              # raiz de composição: só importa módulos
    │
    ├── core/                      # infraestrutura transversal, sem regra de negócio
    │   ├── config/                # schema Zod, validação e EnvService tipado
    │   ├── database/              # opções do TypeORM, DataSource da CLI
    │   │   └── migrations/        # (futuro) migrations versionadas
    │   ├── health/                # health check (terminus)
    │   └── http/                  # Helmet, CORS, pipes, versionamento, Swagger
    │
    ├── shared/                    # (futuro) blocos reutilizáveis entre módulos
    │   ├── domain/                # Entity, AggregateRoot, ValueObject, DomainError
    │   ├── application/           # contratos de caso de uso e porta de UnitOfWork
    │   ├── infrastructure/        # UnitOfWork em TypeORM, lock pessimista, outbox
    │   └── presentation/          # filtros de exceção, DTOs de paginação, decorators
    │
    └── modules/                   # (futuro) um diretório por bounded context
        └── <modulo>/              # ex.: identity, events, inventory, orders
            ├── domain/
            │   ├── entities/
            │   ├── value-objects/
            │   ├── events/
            │   ├── errors/
            │   └── repositories/  # interfaces (portas) dos repositórios
            ├── application/
            │   ├── use-cases/
            │   ├── dtos/          # entrada e saída dos casos de uso
            │   └── ports/         # gateways externos: pagamento, fila, cache
            ├── infrastructure/
            │   ├── persistence/
            │   │   └── typeorm/
            │   │       ├── entities/      # *.orm-entity.ts
            │   │       ├── mappers/       # domínio <-> ORM
            │   │       └── repositories/  # implementam as portas do domínio
            │   └── queue/                 # produtores e consumidores BullMQ
            ├── presentation/
            │   └── http/
            │       ├── controllers/
            │       └── dtos/      # request e response com class-validator e Swagger
            └── <modulo>.module.ts # liga cada porta ao seu adaptador
```

## Responsabilidade de cada camada

### `domain`

O coração do módulo: entidades, value objects, eventos e erros de domínio, além
das **interfaces** dos repositórios. Aqui ficam as invariantes, como "um lote não
vende mais ingressos do que a capacidade".

Não importa `@nestjs/*`, `typeorm`, `class-validator` nem nada de
infraestrutura. É TypeScript puro e testável sem subir nada.

### `application`

Os casos de uso: orquestram o domínio para cumprir uma intenção do usuário
(reservar ingressos, confirmar pagamento). Definem o limite transacional e
declaram as portas de que precisam (`PaymentGateway`, `UnitOfWork`), sem saber
quem as implementa.

Depende apenas de `domain`. Pode usar `@Injectable()` para participar da injeção
de dependência, mas não conhece HTTP, SQL ou Redis.

### `infrastructure`

Os adaptadores que implementam as portas: repositórios TypeORM, mapeadores entre
entidade de domínio e entidade ORM, filas BullMQ e clientes de serviços
externos. É a única camada que sabe que existe PostgreSQL.

As entidades ORM ficam separadas das entidades de domínio. Isso permite mudar o
modelo relacional (índices, colunas de versão para lock otimista) sem tocar na
regra de negócio, e vice-versa.

### `presentation`

A borda HTTP: controllers, DTOs de request e response com `class-validator` e
decorators do Swagger. Converte a requisição em entrada de caso de uso e o
resultado em resposta. Não contém regra de negócio.

### `core`

Infraestrutura de framework compartilhada pela aplicação inteira: configuração,
conexão com banco, bootstrap HTTP e health check. Muda quando o framework muda,
não quando o negócio muda.

### `shared`

Abstrações genéricas usadas por vários módulos, organizadas nas mesmas quatro
camadas e sujeitas à mesma regra de dependência. Entra aqui apenas o que já tem
dois ou mais consumidores reais.

## Regra de dependência

```text
presentation ──> application ──> domain
                     ▲
infrastructure ──────┘ (implementa as portas declaradas em application e domain)
```

- As setas apontam sempre para dentro. `domain` não depende de ninguém.
- `infrastructure` e `presentation` não se conhecem.
- O `<modulo>.module.ts` é a raiz de composição do módulo: é o único lugar que
  liga uma porta ao seu adaptador (`{ provide: EVENT_REPOSITORY, useClass: TypeOrmEventRepository }`).
- Módulos conversam por casos de uso exportados ou por eventos, nunca acessando
  o repositório ou as tabelas de outro módulo.

## Convenções

| Item | Convenção |
| --- | --- |
| Imports relativos | Com extensão `.js`, exigido pelo ESM em `nodenext` |
| Entidade ORM | `*.orm-entity.ts` em `modules/<m>/infrastructure/persistence/` |
| Registro de entidade | `TypeOrmModule.forFeature([...])` no módulo dono |
| Migration | `src/core/database/migrations/<timestamp>-<Nome>.ts` |
| Teste unitário | `*.spec.ts` ao lado do arquivo testado |
| Teste e2e | `test/*.e2e-spec.ts` |
| Rotas | Versionadas por URI (`/api/v1/...`); health é neutro de versão |
