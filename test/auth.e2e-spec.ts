import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { EnvService } from '../src/core/config/env.service.js';
import { configureApp } from '../src/core/http/configure-app.js';

// Requer `npm run infra:up` e `npm run migration:run`.

const RUN_ID = crypto.randomUUID().slice(0, 8);
const PASSWORD = 'Ingresso#2026Seguro';

const emailFor = (label: string): string =>
  `e2e-${RUN_ID}-${label}@ticketforge.dev`;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

describe('Autenticação, sessão e RBAC (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let v1: string;

  const api = () => request(app.getHttpServer());

  const register = async (label: string): Promise<TokenPair> => {
    const { body } = await api()
      .post(`${v1}/auth/register`)
      .send({ email: emailFor(label), password: PASSWORD })
      .expect(201);

    return body as TokenPair;
  };

  const login = async (label: string): Promise<TokenPair> => {
    const { body } = await api()
      .post(`${v1}/auth/login`)
      .send({ email: emailFor(label), password: PASSWORD })
      .expect(200);

    return body as TokenPair;
  };

  const me = (accessToken: string) =>
    api().get(`${v1}/users/me`).auth(accessToken, { type: 'bearer' });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    const env = app.get(EnvService);
    configureApp(app, {
      apiPrefix: env.get('API_PREFIX'),
      corsOrigins: env.get('CORS_ORIGINS'),
    });
    await app.init();

    dataSource = app.get(DataSource);
    v1 = `/${env.get('API_PREFIX')}/v1`;
  });

  afterAll(async () => {
    await dataSource.query('DELETE FROM users WHERE email LIKE $1', [
      `e2e-${RUN_ID}-%`,
    ]);
    await app.close();
  });

  describe('rotas públicas e proteção padrão', () => {
    it('health é público e reporta PostgreSQL e Redis', async () => {
      const { body } = await api().get('/api/health').expect(200);

      expect(body.info).toMatchObject({
        database: { status: 'up' },
        redis: { status: 'up' },
      });
    });

    it('rota sem @Public exige token', async () => {
      const { body } = await api().get(`${v1}/users/me`).expect(401);

      expect(body.error).toBe('INVALID_TOKEN');
    });

    it.each(['Bearer', 'Bearer abc.def.ghi', 'Basic dXNlcjpzZW5oYQ=='])(
      'recusa cabeçalho Authorization inválido: "%s"',
      async (header) => {
        await api()
          .get(`${v1}/users/me`)
          .set('Authorization', header)
          .expect(401);
      },
    );
  });

  describe('cadastro', () => {
    it('cria cliente, abre sessão e dá acesso a /users/me', async () => {
      const tokens = await register('cadastro');

      const { body } = await me(tokens.accessToken).expect(200);

      expect(body).toEqual({
        id: expect.any(String),
        email: emailFor('cadastro'),
        role: 'customer',
        createdAt: expect.any(String),
      });
    });

    it('recusa e-mail já cadastrado, mesmo com caixa diferente', async () => {
      await register('duplicado');

      const { body } = await api()
        .post(`${v1}/auth/register`)
        .send({
          email: emailFor('duplicado').toUpperCase(),
          password: PASSWORD,
        })
        .expect(409);

      expect(body.error).toBe('EMAIL_ALREADY_IN_USE');
    });

    it('cadastros simultâneos do mesmo e-mail: só um vence', async () => {
      const attempt = () =>
        api()
          .post(`${v1}/auth/register`)
          .send({ email: emailFor('corrida'), password: PASSWORD });

      const statuses = (await Promise.all([attempt(), attempt(), attempt()]))
        .map((response) => response.status)
        .sort((a, b) => a - b);

      expect(statuses).toEqual([201, 409, 409]);
    });

    it.each([
      'curta#A1',
      'semsimbolo2026A',
      'SEM#MINUSCULA2026',
      'x'.repeat(129),
    ])('recusa senha fora da política: %s', async (password) => {
      await api()
        .post(`${v1}/auth/register`)
        .send({ email: emailFor('fraca'), password })
        .expect(400);
    });

    it('recusa tentativa de escolher o próprio papel', async () => {
      const { body } = await api()
        .post(`${v1}/auth/register`)
        .send({
          email: emailFor('escalada'),
          password: PASSWORD,
          role: 'admin',
        })
        .expect(400);

      expect(body.message).toContain('property role should not exist');
    });
  });

  describe('login', () => {
    beforeAll(() => register('login'));

    it('autentica com credenciais corretas', async () => {
      const tokens = await login('login');

      await me(tokens.accessToken).expect(200);
    });

    it('senha errada e e-mail inexistente recebem a mesma resposta', async () => {
      const wrongPassword = await api()
        .post(`${v1}/auth/login`)
        .send({ email: emailFor('login'), password: 'Outra#Senha2026' })
        .expect(401);
      const unknownEmail = await api()
        .post(`${v1}/auth/login`)
        .send({ email: emailFor('fantasma'), password: PASSWORD })
        .expect(401);

      expect(wrongPassword.body).toEqual(unknownEmail.body);
      expect(wrongPassword.body.error).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('rotação de refresh token', () => {
    it('emite novo par e invalida o refresh anterior', async () => {
      const initial = await register('rotacao');

      const { body: rotated } = await api()
        .post(`${v1}/auth/refresh`)
        .send({ refreshToken: initial.refreshToken })
        .expect(200);

      expect(rotated.refreshToken).not.toBe(initial.refreshToken);
      await me(rotated.accessToken).expect(200);
    });

    it('reuso do refresh antigo encerra a sessão inteira', async () => {
      const initial = await register('reuso');
      const { body: rotated } = await api()
        .post(`${v1}/auth/refresh`)
        .send({ refreshToken: initial.refreshToken })
        .expect(200);

      const { body } = await api()
        .post(`${v1}/auth/refresh`)
        .send({ refreshToken: initial.refreshToken })
        .expect(401);

      expect(body.error).toBe('REFRESH_TOKEN_REUSED');
      await me(rotated.accessToken).expect(401);
      await api()
        .post(`${v1}/auth/refresh`)
        .send({ refreshToken: rotated.refreshToken })
        .expect(401);
    });

    it('refresh simultâneo com o mesmo token: só uma requisição vence', async () => {
      const initial = await register('concorrencia');
      const attempt = () =>
        api()
          .post(`${v1}/auth/refresh`)
          .send({ refreshToken: initial.refreshToken });

      const statuses = (await Promise.all([attempt(), attempt()]))
        .map((response) => response.status)
        .sort((a, b) => a - b);

      expect(statuses).toEqual([200, 401]);
    });

    it('recusa access token no lugar do refresh token', async () => {
      const tokens = await register('troca-de-tipo');

      await api()
        .post(`${v1}/auth/refresh`)
        .send({ refreshToken: tokens.accessToken })
        .expect(401);
    });
  });

  describe('logout', () => {
    it('revoga access e refresh tokens da sessão imediatamente', async () => {
      const tokens = await register('logout');

      await api()
        .post(`${v1}/auth/logout`)
        .auth(tokens.accessToken, { type: 'bearer' })
        .expect(204);

      const { body } = await me(tokens.accessToken).expect(401);
      expect(body.error).toBe('INVALID_TOKEN');
      await api()
        .post(`${v1}/auth/refresh`)
        .send({ refreshToken: tokens.refreshToken })
        .expect(401);
    });

    it('encerra apenas a sessão atual, não as de outros dispositivos', async () => {
      const first = await register('multisessao');
      const second = await login('multisessao');

      await api()
        .post(`${v1}/auth/logout`)
        .auth(first.accessToken, { type: 'bearer' })
        .expect(204);

      await me(first.accessToken).expect(401);
      await me(second.accessToken).expect(200);
    });
  });

  describe('RBAC', () => {
    let customerId: string;
    let customerToken: string;
    let adminToken: string;

    beforeAll(async () => {
      ({ accessToken: customerToken } = await register('cliente-rbac'));
      ({
        body: { id: customerId },
      } = await me(customerToken).expect(200));

      await register('admin-rbac');
      // A API não promove usuários: o primeiro admin nasce por SQL.
      await dataSource.query(
        `UPDATE users SET role = 'admin' WHERE email = $1`,
        [emailFor('admin-rbac')],
      );
      ({ accessToken: adminToken } = await login('admin-rbac'));
    });

    it('bloqueia papel não autorizado com 403', async () => {
      await api()
        .get(`${v1}/users/${customerId}`)
        .auth(customerToken, { type: 'bearer' })
        .expect(403);
    });

    it('libera o papel exigido', async () => {
      const { body } = await api()
        .get(`${v1}/users/${customerId}`)
        .auth(adminToken, { type: 'bearer' })
        .expect(200);

      expect(body.email).toBe(emailFor('cliente-rbac'));
    });

    it('responde 404 para usuário inexistente e 400 para id inválido', async () => {
      await api()
        .get(`${v1}/users/${crypto.randomUUID()}`)
        .auth(adminToken, { type: 'bearer' })
        .expect(404);
      await api()
        .get(`${v1}/users/nao-e-uuid`)
        .auth(adminToken, { type: 'bearer' })
        .expect(400);
    });
  });
});
