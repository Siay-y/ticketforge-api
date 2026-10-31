# TicketForge | Luiz Santos

API de bilhetagem e venda de ingressos em lote, construída em NestJS 12 para
cenários de alta concorrência: milhares de pessoas disputando o mesmo lote no
mesmo segundo, sem vender o mesmo ingresso duas vezes.

O projeto prioriza consistência ACID no PostgreSQL, segurança defensiva em cada
camada e Clean Architecture, com o domínio isolado de framework e banco.

---

## Visão geral

| Característica | Implementação |
| --- | --- |
| Arquitetura | Clean Architecture por módulo, com transações que atravessam módulos via `UnitOfWork` |
| Concorrência | `SELECT ... FOR UPDATE` com ordem global de locks, sem deadlock |
| Checkout | Reserva de 15 minutos, `Idempotency-Key` obrigatória e cupons de desconto |
| Autenticação | JWT com sessões no Redis, rotação de refresh token e logout imediato |
| Autorização | RBAC fail-closed (`admin`, `organizer`, `customer`) e checagem de dono do recurso |
| Dinheiro | Inteiros em centavos: aritmética exata, sem ponto flutuante |
| Banco | PostgreSQL 18, somente migrations, regras repetidas em `CHECK` |
| Documentação | Swagger (OpenAPI) gerado do código, em `/docs` |

---

## Funcionalidades

- **Venda que nunca passa do estoque.** Lotes e cupom são travados na mesma
  transação do pedido. Um teste automatizado põe 5 compradores disputando os 2
  últimos ingressos: saem 2 pedidos e 3 recusas, nunca saldo negativo.
- **Checkout à prova de duplo clique.** Repetir a mesma `Idempotency-Key`
  devolve o pedido original, sem reservar de novo.
- **Eventos e lotes com regras de verdade.** A soma dos lotes nunca passa da
  capacidade, as vendas terminam até a data do evento e ingresso vendido não some
  quando o organizador reduz um lote.
- **Cupons de desconto.** Percentual ou valor fixo, com validade e limite de
  usos; o cancelamento do pedido devolve estoque e cupom de uma vez.
- **Sessões seguras.** Refresh token de uso único com detecção de roubo, e logout
  que invalida o access token na hora.
- **Cada um no seu lugar.** Organizador só gerencia os próprios eventos, cliente
  só vê os próprios pedidos, e toda rota nasce protegida.

---

## Stack

| Camada | Tecnologia |
| --- | --- |
| Runtime e framework | Node.js 24, NestJS 12, TypeScript 6 (`strict`, ESM) |
| Dados | PostgreSQL 18 com TypeORM 1.x; Redis 8 com ioredis |
| Segurança | `@nestjs/jwt`, `scrypt` nativo, Helmet, `class-validator`, Zod |
| Documentação | `@nestjs/swagger` |
| Testes e qualidade | Vitest, Supertest, Oxlint e Prettier |
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

Preencha `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` no `.env`, um valor
diferente para cada, gerado com:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Suba banco e Redis, aplique as migrations e inicie a API:

```bash
npm run dev
```

A API responde em `http://localhost:3000/api` e o Swagger em
`http://localhost:3000/docs`. Para testar o fluxo completo à mão, abra os guias
[eventos.http](docs/requests/eventos.http) e
[pedidos.http](docs/requests/pedidos.http) com a extensão REST Client do VS Code.

---

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Sobe a infraestrutura, aplica as migrations e inicia a API em modo observador |
| `npm run start:dev` | Só a API em modo observador |
| `npm test` | Testes unitários |
| `npm run test:e2e` | Testes de ponta a ponta (exigem a infraestrutura de pé) |
| `npm run lint` | Oxlint com checagem de tipos |
| `npm run build` | Compila para `dist/` |

Os comandos de migration estão em [Banco de dados](docs/banco-de-dados.md#fluxo-de-trabalho).

---

## Documentação

- [Arquitetura](docs/arquitetura.md): camadas, regra de dependência e comunicação entre módulos.
- [Configuração](docs/configuracao.md): variáveis de ambiente e regras de validação.
- [Banco de dados](docs/banco-de-dados.md): tabelas, índices, locks e migrations.
- [Autenticação, sessão e RBAC](docs/autenticacao.md): tokens, sessões no Redis e papéis.
- [Eventos e lotes](docs/eventos.md): regras de capacidade, datas e estoque.
- [Pedidos, cupons e checkout](docs/pedidos.md): reserva transacional, idempotência e ciclo de vida.
- [Segurança](docs/seguranca.md): o que cada proteção faz e o que ainda falta.

---

## Licença

Distribuído sob a licença MIT. Consulte o arquivo [LICENSE](LICENSE).

Copyright © 2026 Luiz Henrique Porfírio Santos.

---

## Contato

- GitHub: [@Siay-y](https://github.com/Siay-y)
- LinkedIn: [Luiz Henrique Porfírio Santos](https://www.linkedin.com/in/luiz-henrique-porf%C3%ADrio-santos-a8b77229a/)
- E-mail: luiz.porfiriosantos@gmail.com
