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
    │   ├── application/           # (futuro) contratos de UnitOfWork
    │   ├── infrastructure/        # (futuro) UnitOfWork em TypeORM, outbox
    │   └── presentation/
    │       └── http/
    │           ├── decorators/    # @Public()
    │           ├── filters/       # DomainError -> status HTTP
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
camadas e sujeitas à mesma regra de dependência. Entra aqui apenas o que já tem
dois ou mais consumidores reais: `DomainError` (usado por `users` e `auth`) e
`@Public()` (usado por `auth` e `core/health`).

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
| `application` | `application` de outro módulo | Casos de uso exportados pelo `*.module.ts` | `LoginUseCase` chama `VerifyCredentialsUseCase` |
| Qualquer camada | `domain` de outro módulo | Value objects e enums de linguagem compartilhada | `UserRole` no token e no `@Roles()` |
| `presentation` | `auth/presentation` | Decorators de controle de acesso | `@Roles()` e `@CurrentUser()` em `UsersController` |

Os casos de uso exportados devolvem read models (`UserView`), nunca a entidade
de domínio: o chamador não consegue alterar um `User` de outro módulo.

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
| Teste unitário | `*.spec.ts` ao lado do arquivo testado |
| Dublês de teste | `<modulo>/testing/`, excluídos do build de produção |
| Teste e2e | `test/*.e2e-spec.ts` |
| Rotas | Versionadas por URI (`/api/v1/...`); health é neutro de versão |
| Acesso | Toda rota é protegida; abrir exige `@Public()` explícito |
