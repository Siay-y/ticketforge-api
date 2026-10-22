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
| Cache e sessões | Redis 8 via ioredis, com `noeviction`, pronto para BullMQ |
| Autenticação | JWT (access + refresh) com segredos e audiências separados |
| Sessões | Uma por login, no Redis; logout revoga access e refresh na hora |
| Refresh token | Rotação a cada uso, com troca atômica em Lua e detecção de reuso |
| Autorização | `JwtAuthGuard` e `RolesGuard` globais: toda rota nasce protegida |
| Papéis | `admin`, `organizer` e `customer`, restringidos por `@Roles()` |
| Ownership | Organizador só gerencia os próprios eventos; checado no caso de uso |
| Eventos e lotes | Agregado `Event` com invariantes de capacidade, datas e estoque vendido |
| Concorrência | `SELECT ... FOR UPDATE` no agregado; `@VersionColumn` nos lotes |
| Dinheiro | Inteiro em centavos: aritmética exata, sem ponto flutuante |
| Busca | Paginação por página/limite e índices trigram GIN para `ILIKE` |
| Senhas | `scrypt` nativo (perfil OWASP), formato PHC e rehash automático |
| Erros de negócio | `DomainError` com `code` estável, traduzido para HTTP por filtro global |
| Validação de entrada | `ValidationPipe` global com `whitelist`, `forbidNonWhitelisted` e `transform` |
| Segurança HTTP | Helmet e CORS restrito a uma lista explícita de origens |
| Documentação | Swagger (OpenAPI) com esquema `JWT-auth`, ativado por variável de ambiente |
| Versionamento | Por URI (`/api/v1/...`), com health check neutro de versão |
| Saúde | `GET /api/health` com ping no PostgreSQL e no Redis via `@nestjs/terminus` |
| Módulos | ESM nativo (`"type": "module"`, `nodenext`) |

### Rotas disponíveis

| Rota | Acesso | Descrição |
| --- | --- | --- |
| `GET /api/health` | Pública | Estado da API, do PostgreSQL e do Redis |
| `POST /api/v1/auth/register` | Pública | Cadastra um cliente e abre a primeira sessão |
| `POST /api/v1/auth/login` | Pública | Autentica por e-mail e senha |
| `POST /api/v1/auth/refresh` | Pública | Troca o refresh token por um novo par |
| `POST /api/v1/auth/logout` | Autenticada | Encerra a sessão atual |
| `GET /api/v1/users/me` | Autenticada | Perfil do usuário autenticado |
| `GET /api/v1/users/:id` | `admin` | Perfil de qualquer usuário |
| `GET /api/v1/events` | Pública | Eventos publicados, paginados, com busca e intervalo de datas |
| `GET /api/v1/events/:slug` | Pública | Detalhe de um evento publicado, com lotes |
| `POST /api/v1/events` | `organizer`, `admin` | Cria evento em rascunho, com lotes iniciais opcionais |
| `PATCH /api/v1/events/:id` | Dono ou `admin` | Altera dados do evento |
| `POST /api/v1/events/:id/publish` | Dono ou `admin` | Publica o evento |
| `POST /api/v1/events/:id/cancel` | Dono ou `admin` | Cancela o evento |
| `DELETE /api/v1/events/:id` | Dono ou `admin` | Remove (soft delete) rascunho ou cancelado |
| `POST /api/v1/events/:id/batches` | Dono ou `admin` | Adiciona um lote |
| `PATCH /api/v1/events/:id/batches/:batchId` | Dono ou `admin` | Altera um lote |
| `GET /docs` | Pública | Interface do Swagger (com `SWAGGER_ENABLED=true`) |
| `GET /docs/openapi.json` | Pública | Documento OpenAPI em JSON |

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
- **Cadastro e login com sessão.** Cada login abre uma sessão própria no Redis,
  então sair de um dispositivo não derruba os outros.
- **Logout que vale na hora.** O access token só é aceito enquanto a sessão
  existir; depois do logout, nem ele nem o refresh token passam.
- **Refresh token de uso único.** Cada renovação troca o token por um novo de
  forma atômica. Reapresentar um token já trocado é tratado como roubo e encerra
  a sessão inteira.
- **Papel sempre atual.** O papel do usuário é relido do banco a cada renovação,
  então uma promoção ou rebaixamento vale no próximo refresh.
- **RBAC fail-closed.** Toda rota exige token por padrão; abrir uma rota exige
  `@Public()` e restringir por papel exige `@Roles()`.
- **Senhas resistentes.** Política de força no cadastro, hash `scrypt` com salt
  por senha e resposta idêntica para e-mail inexistente e senha errada.
- **E-mail único de verdade.** Normalizado no domínio e garantido por índice
  único no banco, inclusive em cadastros simultâneos.
- **Eventos com lotes, de uma vez só.** O organizador cria o evento já com os
  lotes iniciais, gravados numa única transação: se um lote violar uma regra,
  nem o evento é criado.
- **Capacidade que nunca estoura.** A soma dos lotes não passa da capacidade do
  evento, nem com várias requisições simultâneas: alterações no mesmo evento são
  serializadas por lock.
- **Datas coerentes.** O evento precisa estar no futuro e cada lote vende num
  período que termina até a data do evento, inclusive quando o evento é remarcado.
- **Ingresso vendido não some.** Reduzir um lote abaixo do que já foi vendido é
  recusado; a parte disponível é recalculada preservando as vendas.
- **Cada organizador no seu evento.** Organizadores só alteram, publicam e
  adicionam lotes aos eventos que criaram; administradores gerenciam todos.
- **Catálogo público rápido.** Listagem paginada de eventos publicados, com busca
  por título ou local e filtro por datas, apoiada em índices parciais e trigram.
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
| Cache e sessões | Redis 8 com ioredis (BullMQ nos próximos PRs) |
| Autenticação | `@nestjs/jwt` (HS256) |
| Hash de senha | `scrypt` do `node:crypto` |
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

Suba o banco e o Redis, aplique as migrations e inicie a API, num comando só:

```bash
npm run dev
```

Ele executa, em sequência, `infra:up`, `migration:run` e `start:dev`. Se os
containers já estiverem de pé e não houver migration nova, `npm run start:dev`
sozinho inicia mais rápido.

A API fica disponível em `http://localhost:3000/api` e o Swagger em
`http://localhost:3000/docs`.

Todo cadastro nasce `customer`. Para ter o primeiro administrador, cadastre-se
pela API e promova o usuário no banco:

```bash
docker compose exec postgres psql -U ticketforge -d ticketforge \
  -c "UPDATE users SET role = 'admin' WHERE email = 'voce@exemplo.com'"
```

---

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Sobe a infraestrutura, aplica as migrations e inicia a API em modo observador |
| `npm run start:dev` | API em modo observador (recompila a cada alteração em `src/`) |
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
| `npm run test:e2e` | Testes de ponta a ponta (exigem `infra:up` e `migration:run`) |
| `npm run lint` | Oxlint com checagem de tipos |
| `npm run format` | Prettier em `src/` e `test/` |

---

## Documentação

O detalhe de cada parte fica em `docs/`, para este arquivo continuar sendo uma
apresentação:

- [Arquitetura](docs/arquitetura.md): árvore de pastas, responsabilidade de cada camada e regra de dependência.
- [Configuração](docs/configuracao.md): todas as variáveis de ambiente, padrões e regras de validação.
- [Banco de dados](docs/banco-de-dados.md): tabelas, migrations, convenções de entidade, pool e timeouts.
- [Autenticação, sessão e RBAC](docs/autenticacao.md): tokens, sessão no Redis, rotação, senhas e papéis.
- [Eventos e lotes](docs/eventos.md): modelo, regras de negócio, concorrência, catálogo e códigos de erro.
- [Guia de testes manuais](docs/requests/eventos.http): todas as travas do módulo de eventos, em ordem, para o REST Client.
- [Segurança](docs/seguranca.md): o que cada proteção faz e o que ainda falta.

---

## Segurança

- **Nada sobe com configuração incompleta.** Variável ausente, porta inválida ou
  segredo fraco interrompem o boot antes de abrir qualquer conexão.
- **Segredos não vazam no log.** A mensagem de erro de configuração mostra o
  nome da variável e o motivo, nunca o conteúdo.
- **Rotas protegidas por padrão.** Uma rota sem decorator exige token; nenhuma
  fica pública por esquecimento.
- **Sessões revogáveis e refresh de uso único.** Logout e detecção de reuso
  encerram a sessão no Redis imediatamente.
- **JWT sem brechas clássicas.** Algoritmo fixo, audiência por tipo de token e
  payload validado: `alg: none` e troca de refresh por access são recusados.
- **Senhas nunca saem do módulo de usuários.** O hash fica no banco e nenhuma
  resposta ou caso de uso exportado o devolve.
- **Papel e dono checados separadamente.** `@Roles()` barra quem não pode
  gerenciar eventos; o caso de uso barra quem não é dono daquele evento.
- **Regras repetidas no banco.** Estoque, preço e período de vendas têm `CHECK`
  no PostgreSQL, além da validação no domínio.
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
