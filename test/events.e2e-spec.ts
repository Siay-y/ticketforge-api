import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { EnvService } from '../src/core/config/env.service.js';
import { configureApp } from '../src/core/http/configure-app.js';
import { Event } from '../src/modules/events/domain/entities/event.js';
import { EventRepository } from '../src/modules/events/domain/repositories/event.repository.js';

// Requer `npm run infra:up` e `npm run migration:run`.

const RUN_ID = crypto.randomUUID().slice(0, 8);
// Gerada na execução: nenhuma credencial fica no repositório.
const PASSWORD = `Tf#${crypto.randomUUID()}A1`;

const inDays = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString();

const batchBody = (overrides: Record<string, unknown> = {}) => ({
  name: '1º Lote',
  unitPriceCents: 15000,
  totalQuantity: 100,
  salesStartDate: inDays(1),
  salesEndDate: inDays(30),
  ...overrides,
});

const eventBody = (overrides: Record<string, unknown> = {}) => ({
  title: `Festival ${RUN_ID}`,
  description: 'Dois dias de música ao ar livre.',
  venue: 'Allianz Parque, São Paulo - SP',
  eventDate: inDays(60),
  maxCapacity: 1000,
  ...overrides,
});

interface Account {
  userId: string;
  token: string;
}

describe('Eventos e lotes (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let v1: string;
  let owner: Account;
  let intruder: Account;
  let admin: Account;
  let customer: Account;

  const api = () => request(app.getHttpServer());

  const accountWith = async (
    label: string,
    role?: string,
  ): Promise<Account> => {
    const email = `e2e-${RUN_ID}-${label}@ticketforge.dev`;

    await api()
      .post(`${v1}/auth/register`)
      .send({ email, password: PASSWORD })
      .expect(201);

    if (role) {
      await dataSource.query('UPDATE users SET role = $1 WHERE email = $2', [
        role,
        email,
      ]);
    }

    // Login depois da promoção: o papel vai no access token.
    const { body } = await api()
      .post(`${v1}/auth/login`)
      .send({ email, password: PASSWORD })
      .expect(200);
    const [{ id }] = await dataSource.query<{ id: string }[]>(
      'SELECT id FROM users WHERE email = $1',
      [email],
    );

    return { userId: id, token: body.accessToken as string };
  };

  const as = (account: Account) => ({
    post: (path: string) =>
      api().post(`${v1}${path}`).auth(account.token, { type: 'bearer' }),
    patch: (path: string) =>
      api().patch(`${v1}${path}`).auth(account.token, { type: 'bearer' }),
    delete: (path: string) =>
      api().delete(`${v1}${path}`).auth(account.token, { type: 'bearer' }),
  });

  const createEvent = async (
    account: Account,
    overrides: Record<string, unknown> = {},
  ) => {
    const { body } = await as(account)
      .post('/events')
      .send(eventBody(overrides))
      .expect(201);

    return body as {
      id: string;
      slug: string;
      batches: { id: string }[];
    };
  };

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

    [owner, intruder, admin, customer] = await Promise.all([
      accountWith('dono', 'organizer'),
      accountWith('intruso', 'organizer'),
      accountWith('admin', 'admin'),
      accountWith('cliente'),
    ]);
  });

  afterAll(async () => {
    const pattern = `e2e-${RUN_ID}-%`;

    await dataSource.query(
      'DELETE FROM events WHERE organizer_id IN (SELECT id FROM users WHERE email LIKE $1)',
      [pattern],
    );
    await dataSource.query('DELETE FROM users WHERE email LIKE $1', [pattern]);
    await app.close();
  });

  describe('autorização por papel', () => {
    it('sem token: 401', async () => {
      await api().post(`${v1}/events`).send(eventBody()).expect(401);
    });

    it('cliente não cria evento: 403', async () => {
      await as(customer).post('/events').send(eventBody()).expect(403);
    });

    it('organizador e admin criam', async () => {
      const created = await createEvent(owner);
      await createEvent(admin);

      expect(created).toMatchObject({
        status: 'draft',
        organizerId: owner.userId,
      });
    });

    it('não aceita organizerId no corpo: o dono é sempre quem está autenticado', async () => {
      const { body } = await as(owner)
        .post('/events')
        .send({ ...eventBody(), organizerId: intruder.userId })
        .expect(400);

      expect(body.message).toContain('property organizerId should not exist');
    });
  });

  describe('ownership', () => {
    let eventId: string;

    beforeAll(async () => {
      ({ id: eventId } = await createEvent(owner, {
        initialBatches: [batchBody()],
      }));
    });

    it.each([
      ['altera', 'patch', '', { title: 'Invadido' }],
      ['publica', 'post', '/publish', {}],
      ['adiciona lote', 'post', '/batches', batchBody()],
      ['cancela', 'post', '/cancel', {}],
      ['remove', 'delete', '', {}],
    ] as const)(
      'outro organizador não %s o evento: 403',
      async (_, method, suffix, body) => {
        const { body: error } = await as(intruder)
          [method](`/events/${eventId}${suffix}`)
          .send(body)
          .expect(403);

        expect(error.error).toBe('EVENT_ACCESS_DENIED');
      },
    );

    it('admin altera evento de qualquer organizador', async () => {
      const { body } = await as(admin)
        .patch(`/events/${eventId}`)
        .send({ venue: 'Arena Ajustada pelo Admin' })
        .expect(200);

      expect(body.venue).toBe('Arena Ajustada pelo Admin');
    });

    it('evento inexistente: 404 antes de qualquer checagem de dono', async () => {
      const { body } = await as(intruder)
        .patch(`/events/${crypto.randomUUID()}`)
        .send({ title: 'Nada' })
        .expect(404);

      expect(body.error).toBe('EVENT_NOT_FOUND');
    });
  });

  describe('validação de entrada (400)', () => {
    it.each([
      ['data do evento no passado', { eventDate: inDays(-1) }],
      ['capacidade zero', { maxCapacity: 0 }],
      ['data inválida', { eventDate: 'amanhã' }],
      [
        'lote com fim das vendas antes do início',
        {
          initialBatches: [
            batchBody({ salesStartDate: inDays(10), salesEndDate: inDays(5) }),
          ],
        },
      ],
      [
        'preço fracionário',
        { initialBatches: [batchBody({ unitPriceCents: 99.9 })] },
      ],
      [
        'campo desconhecido no lote',
        { initialBatches: [batchBody({ sold: 10 })] },
      ],
    ])('%s', async (_, overrides) => {
      await as(owner).post('/events').send(eventBody(overrides)).expect(400);
    });

    it('id que não é UUID: 400', async () => {
      await as(owner).patch('/events/nao-e-uuid').send({}).expect(400);
    });
  });

  describe('capacidade e transação ACID na criação (422)', () => {
    it('lotes iniciais acima da capacidade: 422 e nenhum evento gravado', async () => {
      const title = `Estourado ${RUN_ID}`;

      const { body } = await as(owner)
        .post('/events')
        .send(
          eventBody({
            title,
            maxCapacity: 100,
            initialBatches: [
              batchBody({ totalQuantity: 60 }),
              batchBody({ totalQuantity: 41 }),
            ],
          }),
        )
        .expect(422);

      const [{ count }] = await dataSource.query<{ count: string }[]>(
        'SELECT count(*) FROM events WHERE title = $1',
        [title],
      );

      expect(body.error).toBe('EVENT_CAPACITY_EXCEEDED');
      expect(count).toBe('0');
    });

    it('falha do banco no meio da gravação desfaz o evento já inserido', async () => {
      const repository = app.get(EventRepository);
      const valid = Event.create(
        {
          organizerId: owner.userId,
          title: `Rollback ${RUN_ID}`,
          description: 'Transação',
          venue: 'Arena',
          eventDate: new Date(inDays(60)),
          maxCapacity: 1000,
          initialBatches: [
            {
              name: 'Lote',
              unitPriceCents: 100,
              totalQuantity: 10,
              salesStartDate: new Date(inDays(1)),
              salesEndDate: new Date(inDays(30)),
            },
          ],
        },
        new Date(),
      );
      // Mesmo lote duas vezes: o INSERT do evento passa e o dos lotes viola a PK.
      const broken = Event.restore({
        id: valid.id,
        organizerId: valid.organizerId,
        title: valid.title,
        slug: valid.slug,
        description: valid.description,
        venue: valid.venue,
        eventDate: valid.eventDate,
        maxCapacity: valid.maxCapacity,
        status: valid.status,
        batches: [valid.batches[0], valid.batches[0]],
        createdAt: valid.createdAt,
        updatedAt: valid.updatedAt,
        deletedAt: null,
      });

      await expect(repository.create(broken)).rejects.toThrow();

      const rows = await dataSource.query(
        'SELECT 1 FROM events WHERE id = $1',
        [valid.id],
      );
      expect(rows).toHaveLength(0);
    });

    it('lote cujas vendas terminam depois do evento: 422', async () => {
      const { body } = await as(owner)
        .post('/events')
        .send(
          eventBody({
            eventDate: inDays(20),
            initialBatches: [batchBody({ salesEndDate: inDays(21) })],
          }),
        )
        .expect(422);

      expect(body.error).toBe('INVALID_EVENT_SCHEDULE');
    });

    it('novo lote que estoura a capacidade: 422', async () => {
      const { id } = await createEvent(owner, {
        maxCapacity: 100,
        initialBatches: [batchBody({ totalQuantity: 80 })],
      });

      const { body } = await as(owner)
        .post(`/events/${id}/batches`)
        .send(batchBody({ totalQuantity: 21 }))
        .expect(422);

      expect(body.error).toBe('EVENT_CAPACITY_EXCEEDED');
    });

    it('reduzir maxCapacity abaixo do distribuído: 422', async () => {
      const { id } = await createEvent(owner, {
        maxCapacity: 100,
        initialBatches: [batchBody({ totalQuantity: 80 })],
      });

      await as(owner)
        .patch(`/events/${id}`)
        .send({ maxCapacity: 79 })
        .expect(422);
    });

    it('lotes simultâneos que juntos estouram: só um entra', async () => {
      const { id } = await createEvent(owner, { maxCapacity: 100 });
      const attempt = () =>
        as(owner)
          .post(`/events/${id}/batches`)
          .send(batchBody({ totalQuantity: 60 }));

      const statuses = (await Promise.all([attempt(), attempt(), attempt()]))
        .map((response) => response.status)
        .sort((a, b) => a - b);

      const [{ total }] = await dataSource.query<{ total: number }[]>(
        'SELECT COALESCE(SUM(total_quantity), 0)::int AS total FROM ticket_batches WHERE event_id = $1',
        [id],
      );

      expect(statuses).toEqual([201, 422, 422]);
      expect(total).toBe(60);
    });
  });

  describe('imutabilidade do estoque vendido', () => {
    let eventId: string;
    let batchId: string;

    beforeAll(async () => {
      ({
        id: eventId,
        batches: [{ id: batchId }],
      } = await createEvent(owner, {
        initialBatches: [batchBody({ totalQuantity: 100 })],
      }));
      // Simula 30 vendas direto no banco.
      await dataSource.query(
        'UPDATE ticket_batches SET available_quantity = 70 WHERE id = $1',
        [batchId],
      );
    });

    const versionOf = async (): Promise<number> => {
      const [{ version }] = await dataSource.query<{ version: number }[]>(
        'SELECT version FROM ticket_batches WHERE id = $1',
        [batchId],
      );

      return version;
    };

    it('não reduz o total abaixo do vendido: 422', async () => {
      const { body } = await as(owner)
        .patch(`/events/${eventId}/batches/${batchId}`)
        .send({ totalQuantity: 29 })
        .expect(422);

      expect(body.error).toBe('TICKET_BATCH_QUANTITY_BELOW_SOLD');
    });

    it('reduz preservando o vendido e incrementa a versão do lote', async () => {
      const before = await versionOf();

      const { body } = await as(owner)
        .patch(`/events/${eventId}/batches/${batchId}`)
        .send({ totalQuantity: 50 })
        .expect(200);

      expect(body).toMatchObject({
        totalQuantity: 50,
        availableQuantity: 20,
        soldQuantity: 30,
      });
      expect(await versionOf()).toBe(before + 1);
    });

    it('lote de outro evento: 404', async () => {
      const { id: otherEvent } = await createEvent(owner);

      const { body } = await as(owner)
        .patch(`/events/${otherEvent}/batches/${batchId}`)
        .send({ name: 'Errado' })
        .expect(404);

      expect(body.error).toBe('TICKET_BATCH_NOT_FOUND');
    });
  });

  describe('ciclo de vida', () => {
    it('não publica sem lotes: 422', async () => {
      const { id } = await createEvent(owner);

      const { body } = await as(owner)
        .post(`/events/${id}/publish`)
        .expect(422);

      expect(body.error).toBe('EVENT_WITHOUT_BATCHES');
    });

    it('publicado não é removido; cancelado não é alterado; cancelado é removido', async () => {
      const { id, slug } = await createEvent(owner, {
        initialBatches: [batchBody()],
      });
      await as(owner).post(`/events/${id}/publish`).expect(200);
      await api().get(`${v1}/events/${slug}`).expect(200);

      const removePublished = await as(owner)
        .delete(`/events/${id}`)
        .expect(422);
      expect(removePublished.body.error).toBe('INVALID_STATUS_TRANSITION');

      await as(owner).post(`/events/${id}/cancel`).expect(200);
      const editCancelled = await as(owner)
        .patch(`/events/${id}`)
        .send({ title: 'Reaberto' })
        .expect(422);
      expect(editCancelled.body.error).toBe('EVENT_NOT_EDITABLE');

      await as(owner).delete(`/events/${id}`).expect(204);
      await as(owner)
        .patch(`/events/${id}`)
        .send({ title: 'Reaberto' })
        .expect(404);

      const [{ deleted_at }] = await dataSource.query<
        { deleted_at: Date | null }[]
      >('SELECT deleted_at FROM events WHERE id = $1', [id]);
      expect(deleted_at).toBeInstanceOf(Date);
    });
  });

  describe('catálogo público', () => {
    const tag = `catalogo${RUN_ID}`;
    let draftSlug: string;

    beforeAll(async () => {
      for (const days of [40, 50, 60]) {
        const { id } = await createEvent(owner, {
          title: `Show ${tag} D${days}`,
          eventDate: inDays(days),
          initialBatches: [batchBody()],
        });
        await as(owner).post(`/events/${id}/publish`).expect(200);
      }

      ({ slug: draftSlug } = await createEvent(owner, {
        title: `Rascunho ${tag}`,
        initialBatches: [batchBody()],
      }));
    });

    const list = (query: Record<string, string | number>) =>
      api().get(`${v1}/events`).query(query);

    it('é público, paginado e ordenado por data, sem rascunhos', async () => {
      const { body } = await list({ search: tag, limit: 2 }).expect(200);

      expect(body.meta).toEqual({
        page: 1,
        limit: 2,
        totalItems: 3,
        totalPages: 2,
        hasNextPage: true,
        hasPreviousPage: false,
      });
      expect(body.data.map((event: { title: string }) => event.title)).toEqual([
        `Show ${tag} D40`,
        `Show ${tag} D50`,
      ]);
    });

    it('segunda página traz o restante', async () => {
      const { body } = await list({ search: tag, limit: 2, page: 2 }).expect(
        200,
      );

      expect(body.data).toHaveLength(1);
      expect(body.meta.hasNextPage).toBe(false);
    });

    it('filtra por intervalo de datas', async () => {
      const { body } = await list({
        search: tag,
        from: inDays(45),
        to: inDays(55),
      }).expect(200);

      expect(body.data.map((event: { title: string }) => event.title)).toEqual([
        `Show ${tag} D50`,
      ]);
    });

    it('busca ignora caixa e trata % como texto, não curinga', async () => {
      const upper = await list({ search: tag.toUpperCase() }).expect(200);
      const wildcard = await list({ search: '%' }).expect(200);

      expect(upper.body.meta.totalItems).toBe(3);
      expect(wildcard.body.meta.totalItems).toBe(0);
    });

    it.each([
      ['limit acima de 100', { limit: 500 }],
      ['página zero', { page: 0 }],
      ['to antes de from', { from: inDays(10), to: inDays(5) }],
      ['data inválida', { from: 'ontem' }],
    ])('recusa %s: 400', async (_, query) => {
      await list(query).expect(400);
    });

    it('detalhe por slug traz os lotes; rascunho responde 404', async () => {
      const { body: page } = await list({ search: tag, limit: 1 }).expect(200);

      const { body } = await api()
        .get(`${v1}/events/${page.data[0].slug}`)
        .expect(200);

      expect(body.batches).toHaveLength(1);
      expect(body.batches[0]).toMatchObject({
        unitPriceCents: 15000,
        availableQuantity: 100,
      });
      await api().get(`${v1}/events/${draftSlug}`).expect(404);
    });
  });
});
