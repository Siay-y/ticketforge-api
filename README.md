<p align="center">
  <a href="https://nestjs.com/"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="NestJS" /></a>
</p>

<h1 align="center">TicketForge | Luiz Santos</h1>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-12.2-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS 12.2" />
  <img src="https://img.shields.io/badge/Node.js-24.18-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node.js 24.18" />
  <img src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 6.0" />
  <br />
  <img src="https://img.shields.io/badge/PostgreSQL-18-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL 18" />
  <img src="https://img.shields.io/badge/TypeORM-1.1-FE0803?style=for-the-badge&logo=typeorm&logoColor=white" alt="TypeORM 1.1" />
  <img src="https://img.shields.io/badge/Redis-8-FF4438?style=for-the-badge&logo=redis&logoColor=white" alt="Redis 8" />
  <br />
  <img src="https://img.shields.io/badge/JWT-12.0-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="JWT 12.0" />
  <img src="https://img.shields.io/badge/Zod-4.6-408AFF?style=for-the-badge&logo=zod&logoColor=white" alt="Zod 4.6" />
  <img src="https://img.shields.io/badge/Swagger-12.0-85EA2D?style=for-the-badge&logo=swagger&logoColor=white" alt="Swagger 12.0" />
  <br />
  <img src="https://img.shields.io/badge/Vitest-4.1-00FF74?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest 4.1" />
  <img src="https://img.shields.io/badge/Oxlint-1.89-00F7F1?style=for-the-badge&logo=oxc&logoColor=white" alt="Oxlint 1.89" />
  <img src="https://img.shields.io/badge/Prettier-3.9-F7B93E?style=for-the-badge&logo=prettier&logoColor=white" alt="Prettier 3.9" />
  <img src="https://img.shields.io/badge/Docker_Compose-v2-2496ED?style=for-the-badge&logo=docker&logoColor=white" alt="Docker Compose v2" />
</p>

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
