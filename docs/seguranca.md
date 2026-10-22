# Segurança

O que a API já protege, como protege e o que fica para os próximos PRs.

## Autenticação e sessão

Detalhes completos em [Autenticação, sessão e RBAC](autenticacao.md).

- **Fail-closed.** O `JwtAuthGuard` é global: toda rota exige access token, e
  abrir uma rota exige `@Public()` explícito. Esquecer o decorator protege, não expõe.
- **Logout imediato.** O access token só vale enquanto a sessão existir no
  Redis; o logout apaga a sessão e os dois tokens param de valer na hora.
- **Rotação com detecção de reuso.** Cada refresh token é de uso único.
  Reapresentar um token já trocado indica vazamento e encerra a sessão inteira.
- **Troca atômica.** A rotação é um compare-and-swap em Lua no Redis: refresh
  simultâneos com o mesmo token nunca geram duas sessões válidas.
- **JWT endurecido.** Algoritmo fixo (HS256), audiência distinta por tipo de
  token, emissor conferido e payload validado por schema. Sem `alg: none`, sem
  troca de algoritmo, sem refresh token aceito como access token.
- **Senhas com scrypt.** Perfil OWASP, salt por senha, comparação em tempo
  constante e rehash automático quando os parâmetros sobem.
- **Sem enumeração no login.** E-mail inexistente e senha errada recebem a mesma
  resposta, em tempo equivalente.
- **Sem escalada no cadastro.** O papel é sempre `customer`; enviar `role` no
  corpo devolve `400`.

## Autorização de recurso (ownership)

Papel diz o que um usuário pode fazer em geral; ownership diz sobre **qual**
registro. Nos eventos, as duas checagens são independentes:

- **Papel:** `@Roles(ORGANIZER, ADMIN)` nas rotas de gestão barra `customer`
  com `403` antes de qualquer consulta.
- **Dono:** a política `assertCanManage` roda dentro do caso de uso, com o
  evento já carregado: organizador só gerencia evento com `organizerId` igual ao
  seu id; admin gerencia qualquer um. Falha devolve `403 EVENT_ACCESS_DENIED`.
- **Dono imposto pelo servidor:** `organizerId` vem sempre do token. Enviá-lo no
  corpo devolve `400`, então ninguém cria evento em nome de outro.
- **Defesa em profundidade:** o caso de uso de criação repete a checagem de
  papel. Se uma rota futura esquecer o `@Roles()`, a regra continua valendo.

Evento inexistente responde `404` antes da checagem de dono. Isso revela a
organizadores autenticados que um id existe, o que é aceitável: os ids são UUID
aleatórios e eventos publicados já são públicos.

## Configuração

- **Fail fast.** O schema Zod roda antes de qualquer módulo. Variável ausente ou
  inválida interrompe o boot com código 1, em vez de a API subir com um valor
  padrão perigoso e falhar só em produção.
- **Sem vazamento no log.** A mensagem de erro contém o nome da variável e o
  motivo, nunca o valor recebido. A única exceção é a origem CORS inválida, que
  não é segredo e precisa aparecer para ser corrigida.
- **Segredos JWT fortes e separados.** No mínimo 32 caracteres, e o segredo de
  refresh precisa ser diferente do de access. Com o mesmo segredo, um refresh
  token vazado valeria como access token.
- **`.env` fora do Git.** Apenas o `.env.example`, sem segredos JWT preenchidos,
  é versionado.

## HTTP

### Helmet

Aplica os cabeçalhos padrão do Helmet 8, entre eles:

| Cabeçalho | Efeito |
| --- | --- |
| `Content-Security-Policy` | Restringe a origem de scripts, estilos e frames |
| `Strict-Transport-Security` | Força HTTPS no navegador após o primeiro acesso |
| `X-Content-Type-Options: nosniff` | Impede o navegador de adivinhar o tipo do conteúdo |
| `X-Frame-Options: SAMEORIGIN` | Bloqueia a API dentro de iframes de outros sites |
| `Cross-Origin-Resource-Policy` | Limita quem pode embutir as respostas |

Também remove o `X-Powered-By`, que anunciaria o Express. A interface do Swagger
funciona com o CSP padrão porque o `@nestjs/swagger` serve seus scripts como
arquivos, sem script inline.

### CORS

- Somente as origens de `CORS_ORIGINS` recebem `Access-Control-Allow-Origin`.
  Curinga (`*`) é rejeitado na validação.
- `credentials: true`, reservado para uma futura entrega do refresh token em
  cookie `httpOnly` (hoje ele trafega no corpo). Isso só é seguro porque a lista
  de origens é explícita.
- Métodos e cabeçalhos aceitos são listados, e o preflight fica em cache por 10
  minutos.

CORS protege o usuário no navegador, não a API: clientes fora do navegador
ignoram esses cabeçalhos. A autorização de cada rota continua sendo
responsabilidade da autenticação.

### Validação de entrada

O `ValidationPipe` global roda com:

| Opção | Efeito |
| --- | --- |
| `whitelist: true` | Remove do corpo os campos sem decorator de validação |
| `forbidNonWhitelisted: true` | Em vez de remover em silêncio, responde `400` |
| `transform: true` | Entrega ao controller uma instância do DTO |

Rejeitar campos extras evita mass assignment: um cliente não consegue enviar
`unitPrice` ou `status` e ver o valor chegar ao caso de uso. A conversão
implícita de tipos está desligada, então `"2"` não vira `2` sem um
`@Type(() => Number)` explícito no DTO.

## Banco de dados

- `synchronize: false` em todos os ambientes: nenhuma alteração de schema acontece
  sem migration revisada.
- TLS com verificação de certificado quando `DATABASE_SSL=true`.
- Timeouts de query e de transação ociosa impedem que um lock preso derrube a
  venda de um lote inteiro. Ver [Banco de dados](banco-de-dados.md#pool-e-timeouts).

## Infraestrutura local

- PostgreSQL e Redis publicam portas apenas em `127.0.0.1`, inacessíveis pela
  rede local.
- O Redis exige senha. O healthcheck usa `REDISCLI_AUTH` para não expor a senha
  na linha de comando do `redis-cli`.
- O Compose usa `${VAR:?}`: sem as credenciais no `.env`, os containers não sobem.

## Ainda não coberto

Itens planejados para os próximos PRs:

- Rate limiting (`@nestjs/throttler` com storage em Redis), essencial na abertura
  de vendas e contra força bruta em `/auth/login` e enumeração em `/auth/register`.
- Bloqueio temporário de conta após tentativas de login seguidas.
- Endpoint de gestão de papéis e revogação de todas as sessões de um usuário.
- Confirmação de e-mail e recuperação de senha.
- Resposta `503` (em vez de `500`) quando o Redis estiver indisponível.
- Filtro para erros não mapeados, com resposta padronizada e sem stack trace.
- Limite explícito de tamanho do corpo por rota.
- `trust proxy` configurado para o IP real do cliente atrás de load balancer.
- Logs estruturados com correlação de requisição.
