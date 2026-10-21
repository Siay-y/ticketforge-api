# TicketForge | Luiz Santos

API de bilhetagem e venda de ingressos em lote, construída em NestJS 12 para
cenários de alta concorrência: milhares de pessoas disputando o mesmo lote no
mesmo segundo, sem vender o mesmo assento duas vezes.

O projeto prioriza consistência ACID no PostgreSQL, segurança defensiva em cada
camada e Clean Architecture, com o domínio isolado de framework e banco.

---

## Visão geral

| Característica | Implementação |
| --- | --- |
| Arquitetura | Clean Architecture por módulo: `domain`, `application`, `infrastructure`, `presentation` |
| Configuração | `@nestjs/config` com schema Zod; a API não sobe com variável ausente ou inválida |
| Banco de dados | PostgreSQL 18 via TypeORM 1.x, somente migrations (`synchronize: false`) |
| Migrations | CLI do TypeORM sobre um `DataSource` próprio, fora do runtime do Nest |
| Proteção de locks | `statement_timeout` e `idle_in_transaction_session_timeout` por conexão |
| Cache e filas | Redis 8 com `noeviction`, pronto para BullMQ |
| Validação de entrada | `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e `transform` |
| Segurança HTTP | Helmet e CORS restrito a uma lista explícita de origens |
| Documentação | Swagger (OpenAPI) com esquema Bearer JWT, ativado por variável de ambiente |
| Versionamento | Por URI (`/api/v1/...`), com health check neutro de versão |
| Saúde | `GET /api/health` com ping no PostgreSQL via `@nestjs/terminus` |
| Módulos | ESM nativo (`"type": "module"`, `nodenext`) |

### Rotas disponíveis

| Rota | Descrição |
| --- | --- |
| `GET /api/health` | Estado da API e do PostgreSQL |
| `GET /docs` | Interface do Swagger (com `SWAGGER_ENABLED=true`) |
| `GET /docs/openapi.json` | Documento OpenAPI em JSON |

---

## Funcionalidades

- **Falha rápida na configuração.** Todas as variáveis passam por um schema Zod
  antes de qualquer módulo subir. O erro lista cada variável ausente ou inválida
  pelo nome, sem nunca imprimir o valor, e o processo encerra com código 1.
- **Configuração tipada.** O `EnvService` devolve valores já convertidos
  (`number`, `boolean`, `string[]`) e com tipo inferido do schema, sem
  `process.env` espalhado pelo código.
- **Regras de segurança na própria validação.** Segredos JWT com no mínimo 32
  caracteres e diferentes entre si; origens CORS sem curinga, caminho ou barra
  final; portas dentro do intervalo válido.
- **Migrations fora do runtime.** O `data-source.ts` é carregado apenas pela CLI
  do TypeORM e valida só as variáveis de banco, então um job de migration não
  precisa conhecer segredos JWT.
- **Mesma configuração de banco nos dois mundos.** Runtime e CLI compartilham a
  mesma fábrica de opções, o que evita divergência entre o banco que a API usa e
  o banco que a migration altera.
- **Transações protegidas contra travamento.** Queries longas e transações
  esquecidas abertas são encerradas pelo próprio PostgreSQL, liberando os locks
  de linha que bloqueariam a venda dos demais compradores.
- **Contrato HTTP estrito.** Campos fora do DTO devolvem `400`, o corpo chega ao
  controller como instância da classe e não há conversão implícita de tipos.
- **Infraestrutura local em um comando.** PostgreSQL e Redis com volumes,
  healthcheck e portas expostas apenas em `127.0.0.1`, lendo o mesmo `.env` da API.

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Runtime | Node.js 24.18 |
| Framework | NestJS 12 (`@nestjs/platform-express`) |
| Linguagem | TypeScript 6 com `strict` |
| Banco de dados | PostgreSQL 18 com TypeORM 1.x e driver `pg` |
| Cache e filas | Redis 8 (BullMQ nos próximos PRs) |
| Configuração | `@nestjs/config` e Zod 4 |
| Validação | `class-validator` e `class-transformer` |
| Segurança HTTP | Helmet |
| Documentação | `@nestjs/swagger` |
| Health check | `@nestjs/terminus` |
| Testes | Vitest e Supertest |
| Qualidade | Oxlint (type-aware) e Prettier |
| Infraestrutura local | Docker Compose |

---

## Pré-requisitos

- Node.js 24.18.0 ou superior
- Docker com Docker Compose v2

---

## Início rápido

```bash
git clone https://github.com/Siay-y/ticketforge-api.git
cd ticketforge-api
npm ci
cp .env.example .env
```

Gere os dois segredos JWT e preencha `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET`
no `.env` (um valor diferente para cada):

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Suba o banco e o Redis, aplique as migrations e inicie a API:

```bash
npm run infra:up
npm run migration:run
npm run start:dev
```

A API fica disponível em `http://localhost:3000/api` e o Swagger em
`http://localhost:3000/docs`.

---

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run start:dev` | API em modo observador |
| `npm run build` | Compila para `dist/` |
| `npm run start:prod` | Executa o build compilado |
| `npm run infra:up` | Sobe PostgreSQL e Redis e aguarda o healthcheck |
| `npm run infra:down` | Derruba os containers (os volumes são mantidos) |
| `npm run migration:create -- src/core/database/migrations/<Nome>` | Cria uma migration vazia |
| `npm run migration:generate -- src/core/database/migrations/<Nome>` | Gera migration a partir da diferença entre entidades e banco |
| `npm run migration:run` | Aplica as migrations pendentes |
| `npm run migration:revert` | Desfaz a última migration aplicada |
| `npm run migration:show` | Lista as migrations e o estado de cada uma |
| `npm test` | Testes unitários |
| `npm run test:e2e` | Testes de ponta a ponta da camada HTTP |
| `npm run lint` | Oxlint com checagem de tipos |
| `npm run format` | Prettier em `src/` e `test/` |

---

## Documentação

O detalhe de cada parte fica em `docs/`, para este arquivo continuar sendo uma
apresentação:

- [Arquitetura](docs/arquitetura.md): árvore de pastas, responsabilidade de cada camada e regra de dependência.
- [Configuração](docs/configuracao.md): todas as variáveis de ambiente, padrões e regras de validação.
- [Banco de dados](docs/banco-de-dados.md): migrations, convenções de entidade, pool e timeouts.
- [Segurança](docs/seguranca.md): o que cada proteção faz e o que ainda falta.

---

## Segurança

- **Nada sobe com configuração incompleta.** Variável ausente, porta inválida ou
  segredo fraco interrompem o boot antes de abrir qualquer conexão.
- **Segredos não vazam no log.** A mensagem de erro de configuração mostra o
  nome da variável e o motivo, nunca o conteúdo.
- **`synchronize` desligado em todos os ambientes.** O schema só muda por
  migration revisada e versionada.
- **CORS por lista explícita.** Origens não listadas não recebem cabeçalhos CORS
  e o navegador bloqueia a resposta.
- **Infraestrutura local fechada.** PostgreSQL e Redis escutam apenas no
  loopback e o Redis exige senha.

Detalhes e limitações conhecidas em [docs/seguranca.md](docs/seguranca.md).

---

## Licença

Projeto privado, sem licença de uso ou distribuição (`UNLICENSED`).

Copyright © 2026 Luiz Henrique Porfírio Santos.

---

## Contato

- GitHub: [@Siay-y](https://github.com/Siay-y)
- LinkedIn: [Luiz Henrique Porfírio Santos](https://www.linkedin.com/in/luiz-henrique-porf%C3%ADrio-santos-a8b77229a/)
- E-mail: luiz.porfiriosantos@gmail.com
