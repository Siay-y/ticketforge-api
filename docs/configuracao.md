# Configuração

Toda a configuração vem de variáveis de ambiente, descritas em
[`.env.example`](../.env.example) e validadas pelo schema Zod em
[`src/core/config/env.schema.ts`](../src/core/config/env.schema.ts).

## Como funciona

1. O `ConfigModule` lê o `.env` (quando existe) e o `process.env`. Variáveis já
   definidas no processo têm precedência sobre o arquivo.
2. O resultado passa por `validateEnv`. Se algo falhar, o boot é interrompido com
   a lista de problemas e o processo encerra com código 1.
3. Os valores validados, já convertidos para o tipo certo, ficam disponíveis
   pelo `EnvService`.

```ts
constructor(private readonly env: EnvService) {}

this.env.get('PORT');          // number
this.env.get('CORS_ORIGINS');  // string[]
this.env.get('DATABASE_SSL');  // boolean
```

Variáveis que não estão no schema são descartadas: o `EnvService` só enxerga o
que foi declarado e validado. Para adicionar uma variável, declare-a no schema do
grupo correspondente e documente-a no `.env.example`.

Exemplo de falha:

```text
Error: Configuração de ambiente inválida:
  - CORS_ORIGINS: Origem inválida: "*"
  - DATABASE_PASSWORD: variável obrigatória ausente
  - JWT_ACCESS_SECRET: Use no mínimo 32 caracteres
```

## Variáveis

Valores booleanos aceitam `true`/`false`, `1`/`0`, `yes`/`no` e `on`/`off`.

### Aplicação

| Variável | Obrigatória | Padrão | Regra |
| --- | --- | --- | --- |
| `NODE_ENV` | Não | `development` | `development`, `test` ou `production` |
| `PORT` | Não | `3000` | Inteiro entre 1 e 65535 |
| `API_PREFIX` | Não | `api` | Letras minúsculas, números e hífen |
| `CORS_ORIGINS` | Sim | | Lista separada por vírgula de `protocolo://host[:porta]` |
| `SWAGGER_ENABLED` | Não | `false` | Booleano |
| `SWAGGER_PATH` | Não | `docs` | Letras minúsculas, números e hífen |

### PostgreSQL

| Variável | Obrigatória | Padrão | Regra |
| --- | --- | --- | --- |
| `DATABASE_HOST` | Sim | | Texto não vazio |
| `DATABASE_PORT` | Sim | | Inteiro entre 1 e 65535 |
| `DATABASE_USER` | Sim | | Texto não vazio |
| `DATABASE_PASSWORD` | Sim | | Texto não vazio |
| `DATABASE_NAME` | Sim | | Texto não vazio |
| `DATABASE_SSL` | Não | `false` | Booleano; com `true`, exige certificado válido |
| `DATABASE_LOGGING` | Não | `false` | Booleano; com `true`, registra todas as queries |
| `DATABASE_POOL_MAX` | Não | `10` | Inteiro entre 1 e 100 |
| `DATABASE_STATEMENT_TIMEOUT_MS` | Não | `10000` | Inteiro positivo, em milissegundos |

### Redis

| Variável | Obrigatória | Padrão | Regra |
| --- | --- | --- | --- |
| `REDIS_HOST` | Sim | | Texto não vazio |
| `REDIS_PORT` | Sim | | Inteiro entre 1 e 65535 |
| `REDIS_PASSWORD` | Sim | | Texto não vazio |
| `REDIS_DB` | Não | `0` | Inteiro entre 0 e 15 |

### JWT

| Variável | Obrigatória | Padrão | Regra |
| --- | --- | --- | --- |
| `JWT_ACCESS_SECRET` | Sim | | Mínimo de 32 caracteres |
| `JWT_ACCESS_EXPIRES_IN` | Sim | | `<número><s\|m\|h\|d>`, ex.: `15m`; maior que zero |
| `JWT_REFRESH_SECRET` | Sim | | Mínimo de 32 caracteres, diferente do access |
| `JWT_REFRESH_EXPIRES_IN` | Sim | | `<número><s\|m\|h\|d>`, ex.: `7d`; maior que a do access |

As durações chegam ao código já convertidas para **segundos**
(`env.get('JWT_ACCESS_EXPIRES_IN')` devolve `900` para `15m`). O mesmo número
vira o `exp` do JWT e o TTL da sessão no Redis, então os dois nunca divergem. O
uso de cada variável está em [Autenticação, sessão e RBAC](autenticacao.md).

## Grupos de variáveis

O schema é dividido em grupos (`appEnvSchema`, `databaseEnvSchema`,
`redisEnvSchema`, `jwtEnvSchema`). Quem precisa de um recorte usa
`EnvService.pick(schema)` e recebe só aquele grupo, tipado:

```ts
const redis = env.pick(redisEnvSchema); // { REDIS_HOST, REDIS_PORT, ... }
```

## Validação parcial na CLI de migrations

O `data-source.ts` valida apenas o grupo `databaseEnvSchema`. Um job de CI que só
aplica migrations precisa das credenciais do banco, não dos segredos JWT.
