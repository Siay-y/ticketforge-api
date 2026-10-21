# Banco de dados

PostgreSQL 18 acessado pelo TypeORM 1.x. O schema muda **somente** por
migration: `synchronize` e `migrationsRun` estão desligados em todos os ambientes.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| [`typeorm-options.factory.ts`](../src/core/database/typeorm-options.factory.ts) | Fonte única das opções de conexão, usada pelo runtime e pela CLI |
| [`database.module.ts`](../src/core/database/database.module.ts) | Conexão assíncrona do Nest, alimentada pelo `EnvService` |
| [`data-source.ts`](../src/core/database/data-source.ts) | `DataSource` carregado apenas pela CLI do TypeORM |

## Runtime e CLI

Os dois usam `buildDataSourceOptions`, com uma diferença deliberada no
carregamento de entidades:

- **Runtime (Nest):** `autoLoadEntities: true`. Cada módulo registra as próprias
  entidades com `TypeOrmModule.forFeature`, e uma entidade só existe na conexão
  se o módulo dono estiver importado.
- **CLI:** glob `modules/**/infrastructure/persistence/**/*.orm-entity.js`. Por
  isso o sufixo `.orm-entity.ts` é obrigatório para entidades persistidas.

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
