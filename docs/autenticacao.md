# Autenticação, sessão e RBAC

Como a API identifica quem faz a requisição, mantém a sessão e decide o que cada
papel pode acessar.

## Visão geral do fluxo

```text
register / login ──> sessão criada no Redis ──> par de tokens (access + refresh)
                                                      │
           requisição com access token <──────────────┤
           JwtAuthGuard: assinatura + sessão ativa    │
           RolesGuard: papel exigido pela rota        │
                                                      │
           refresh ──> troca atômica do jti ──> novo par na mesma sessão
           logout  ──> sessão apagada ──> access e refresh param de valer na hora
```

## Rotas

| Rota | Acesso | Resposta |
| --- | --- | --- |
| `POST /api/v1/auth/register` | Pública | `201` com par de tokens; o usuário nasce `customer` |
| `POST /api/v1/auth/login` | Pública | `200` com par de tokens; cada login abre uma sessão nova |
| `POST /api/v1/auth/refresh` | Pública | `200` com novo par; o refresh enviado deixa de valer |
| `POST /api/v1/auth/logout` | Autenticada | `204`; encerra apenas a sessão do token usado |
| `GET /api/v1/users/me` | Autenticada | `200` com o perfil de quem chamou |
| `GET /api/v1/users/:id` | `admin` | `200` com o perfil pedido |

Formato do par de tokens:

```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

## Tokens

Dois JWTs HS256 com segredos, audiências e validades próprios:

| | Access token | Refresh token |
| --- | --- | --- |
| Uso | Cabeçalho `Authorization: Bearer` | Somente no corpo de `/auth/refresh` |
| Segredo | `JWT_ACCESS_SECRET` | `JWT_REFRESH_SECRET` |
| Audiência (`aud`) | `ticket-forge:access` | `ticket-forge:refresh` |
| Validade | `JWT_ACCESS_EXPIRES_IN` (ex.: 15 min) | `JWT_REFRESH_EXPIRES_IN` (ex.: 7 dias) |
| Claims | `sub` (usuário), `sid` (sessão), `role` | `sub`, `sid`, `jti` (id do token) |

Na verificação, o algoritmo é fixo em HS256 (um `alg: none` ou outro algoritmo
no cabeçalho é recusado), emissor e audiência são conferidos e o payload passa
por um schema Zod: `sub` e `sid` precisam ser UUID e `role` precisa existir no
enum. Qualquer falha vira o mesmo `401 INVALID_TOKEN`, sem dizer o motivo.

## Sessão no Redis

Cada sessão é um hash com TTL igual à validade do refresh token:

```text
auth:session:<sid>   HASH { userId, tokenId, createdAt }   TTL = JWT_REFRESH_EXPIRES_IN
```

`tokenId` é o `jti` do **único** refresh token aceito para a sessão naquele
momento. A sessão nasce no login (ou cadastro) e morre por um destes caminhos:
logout, detecção de reuso ou expiração do TTL.

### Access token também consulta a sessão

O `JwtAuthGuard` não confia só na assinatura: depois de validar o JWT, confere
se `auth:session:<sid>` ainda existe. Um `EXISTS` no Redis por requisição é o
preço de o logout valer **imediatamente**, em vez de o access token continuar
aceito até expirar.

### Rotação do refresh token

A cada `/auth/refresh`:

1. O JWT é verificado (assinatura, audiência, validade).
2. Um script Lua compara o `jti` apresentado com o `tokenId` da sessão e, se
   forem iguais, grava um `jti` novo e renova o TTL. Comparar e trocar acontece
   numa operação atômica: duas requisições simultâneas com o mesmo token nunca
   passam as duas.
3. O papel do usuário é relido do banco, e o novo par é assinado com ele.

| Situação | Resultado |
| --- | --- |
| `jti` igual ao ativo | Rotação: novo par, refresh anterior invalidado |
| `jti` diferente do ativo | **Reuso:** a sessão é apagada e a resposta é `401 REFRESH_TOKEN_REUSED` |
| Sessão inexistente | Expirada ou encerrada: `401 INVALID_TOKEN` |
| Usuário removido | A sessão é apagada: `401 INVALID_TOKEN` |

Reapresentar um refresh já trocado só acontece se o token vazou: o cliente
legítimo sempre guarda o mais novo. Como não dá para saber qual dos dois lados é
o atacante, a sessão inteira é encerrada, inclusive o par mais recente.

O custo dessa regra é que um cliente que dispare dois refresh em paralelo com o
mesmo token perde a sessão. O cliente deve serializar a renovação (uma chamada
de refresh por vez).

## Senhas

### Política

Validada no DTO de cadastro: de 12 a 128 caracteres, com ao menos uma letra
minúscula, uma maiúscula, um número e um símbolo. O teto de 128 evita que
senhas enormes sejam usadas para consumir CPU no hash. O login aplica só o teto,
sem revelar a política.

### Armazenamento

`scrypt` nativo do `node:crypto`, sem dependência externa nem binário nativo:

| Parâmetro | Valor |
| --- | --- |
| Custo (N) | 2^15 |
| Tamanho de bloco (r) | 8 |
| Paralelismo (p) | 3 |
| Salt | 16 bytes aleatórios por senha |
| Chave derivada | 64 bytes |

É um dos perfis recomendados pela OWASP, equivalente a N=2^17 com p=1, mas
usando 32 MiB por hash em vez de 128 MiB, o que pesa num pico de logins
simultâneos. A senha é normalizada em Unicode NFKC antes do hash e a comparação
usa `timingSafeEqual`.

O hash é guardado no formato PHC, com os parâmetros embutidos:

```text
$scrypt$ln=15,r=8,p=3$<salt base64>$<hash base64>
```

Assim os parâmetros podem subir no futuro sem invalidar senhas antigas: no
próximo login bem-sucedido, um hash com parâmetros mais fracos é refeito
automaticamente. Parâmetros lidos do banco têm teto, para que um hash adulterado
não force um cálculo que esgote memória.

### Enumeração de usuários

- Login com e-mail inexistente e com senha errada devolvem a mesma resposta.
- Para e-mail inexistente, a API ainda calcula um hash contra um valor
  descartável, para o tempo de resposta não denunciar quais e-mails existem.
- O cadastro responde `409` para e-mail já usado. É inevitável num cadastro
  aberto; a mitigação é limitar a taxa de requisições (ver
  [Segurança](seguranca.md#ainda-não-coberto)).

## RBAC

### Papéis

| Papel | Valor | Como é obtido |
| --- | --- | --- |
| Cliente | `customer` | Todo cadastro pela API |
| Organizador | `organizer` | Concedido por um administrador |
| Administrador | `admin` | Concedido por um administrador |

O cadastro nunca aceita papel no corpo: um `role` enviado é rejeitado com `400`
pelo `forbidNonWhitelisted`.

Ainda não há endpoint de gestão de papéis. O primeiro administrador é promovido
direto no banco:

```sql
UPDATE users SET role = 'admin' WHERE email = 'voce@exemplo.com';
```

O papel novo passa a valer no próximo login ou na próxima rotação do refresh
token, que relê o papel do banco.

### Guards globais

Registrados como `APP_GUARD` no `AuthModule`, nesta ordem:

1. **`JwtAuthGuard`**: toda rota exige access token válido de sessão ativa. Uma
   rota esquecida sem decorator nasce protegida (fail-closed).
2. **`RolesGuard`**: se a rota tiver `@Roles()`, exige um dos papéis listados,
   senão `403`.

### Decorators

```ts
@Public()                         // abre a rota: sem token
@Roles(UserRole.ADMIN)            // exige um dos papéis (e documenta o 403 no Swagger)
@CurrentUser() user: AuthenticatedUser  // { userId, sessionId, role }
```

`@Public()` mora em `shared/` porque também é usado pelo health check, fora dos
módulos. `@Roles()` e `@CurrentUser()` pertencem ao módulo `auth`.

## Indisponibilidade do Redis

A checagem de sessão falha fechada: com o Redis fora, requisições autenticadas
recebem `500` e nenhuma passa sem verificação. O cliente ioredis roda sem fila
offline e com timeout de comando de 2 s, então a falha é imediata em vez de
segurar conexões. O health check passa a responder `503`, e tudo volta sozinho
quando o Redis retorna. Se o Redis estiver fora no boot, a API não sobe.

## Códigos de erro

| HTTP | `error` | Quando |
| --- | --- | --- |
| 400 | `Bad Request` | Corpo fora do DTO (formato do `ValidationPipe`) |
| 401 | `INVALID_CREDENTIALS` | E-mail ou senha inválidos no login |
| 401 | `INVALID_TOKEN` | Token ausente, malformado, expirado ou de sessão encerrada |
| 401 | `REFRESH_TOKEN_REUSED` | Refresh token já trocado; a sessão foi encerrada |
| 403 | `Forbidden` | Papel sem permissão para a rota |
| 404 | `USER_NOT_FOUND` | Usuário inexistente |
| 409 | `EMAIL_ALREADY_IN_USE` | Cadastro com e-mail já usado |
