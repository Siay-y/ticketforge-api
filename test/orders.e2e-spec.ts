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
// Gerada na execução: nenhuma credencial fica no repositório.
const PASSWORD = `Tf#${crypto.randomUUID()}A1`;

const hoursFromNow = (hours: number): string =>
  new Date(Date.now() + hours * 3_600_000).toISOString();

interface Account {
  userId: string;
  token: string;
}

interface Batch {
  id: string;
  name: string;
}

interface OrderBody {
  eventId: string;
  items: { batchId: string; quantity: number }[];
  couponCode?: string;
}

describe('Pedidos, cupons e checkout (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let v1: string;

  let owner: Account;
  let intruder: Account;
  let admin: Account;
  let buyer: Account;
  let otherBuyer: Account;
  let crowd: Account[];

  let eventId: string;
  let otherEventId: string;
  let draftEventId: string;
  let batches: Record<
    'pista' | 'camarote' | 'futuro' | 'escasso' | 'ultimos',
    Batch
  >;
  let otherEventBatch: Batch;
  let draftBatch: Batch;

  const api = () => request(app.getHttpServer());

  const as = (account: Account) => ({
    get: (path: string) =>
      api().get(`${v1}${path}`).auth(account.token, { type: 'bearer' }),
    post: (path: string) =>
      api().post(`${v1}${path}`).auth(account.token, { type: 'bearer' }),
  });

  const placeOrder = (
    account: Account,
    body: OrderBody,
    idempotencyKey: string = crypto.randomUUID(),
  ) =>
    as(account)
      .post('/orders')
      .set('Idempotency-Key', idempotencyKey)
      .send(body);

  const availableOf = async (batchId: string): Promise<number> => {
    const [{ available }] = await dataSource.query<{ available: number }[]>(
      'SELECT available_quantity AS available FROM ticket_batches WHERE id = $1',
      [batchId],
    );

    return available;
  };

  const usedCountOf = async (code: string): Promise<number> => {
    const [{ used }] = await dataSource.query<{ used: number }[]>(
      'SELECT used_count AS used FROM coupons WHERE event_id = $1 AND code = $2',
      [eventId, code],
    );

    return used;
  };

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

  const batchBody = (
    name: string,
    overrides: Record<string, unknown> = {},
  ) => ({
    name,
    unitPriceCents: 10_000,
    totalQuantity: 100,
    salesStartDate: hoursFromNow(-1),
    salesEndDate: hoursFromNow(24 * 30),
    ...overrides,
  });

  const createEvent = async (
    title: string,
    initialBatches: ReturnType<typeof batchBody>[],
    { publish = true } = {},
  ): Promise<{ id: string; batches: Batch[] }> => {
    const { body } = await as(owner)
      .post('/events')
      .send({
        title: `${title} ${RUN_ID}`,
        description: 'Evento de teste de pedidos.',
        venue: 'Arena de Testes',
        eventDate: hoursFromNow(24 * 60),
        maxCapacity: 10_000,
        initialBatches,
      })
      .expect(201);

    if (publish) {
      await as(owner).post(`/events/${body.id}/publish`).expect(200);
    }

    return body as { id: string; batches: Batch[] };
  };

  const createCoupon = (
    code: string,
    overrides: Record<string, unknown> = {},
  ) =>
    as(owner)
      .post(`/events/${eventId}/coupons`)
      .send({
        code,
        discountType: 'percentage',
        discountValue: 1500,
        expiresAt: hoursFromNow(24 * 20),
        ...overrides,
      });

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

    [owner, intruder, admin, buyer, otherBuyer, ...crowd] = await Promise.all([
      accountWith('dono', 'organizer'),
      accountWith('intruso', 'organizer'),
      accountWith('admin', 'admin'),
      accountWith('comprador'),
      accountWith('outro-comprador'),
      ...[0, 1, 2, 3, 4].map((index) => accountWith(`multidao-${index}`)),
    ]);

    const main = await createEvent('Show Principal', [
      batchBody('Pista', { unitPriceCents: 10_000 }),
      batchBody('Camarote', { unitPriceCents: 5_000, totalQuantity: 20 }),
      batchBody('Futuro', {
        salesStartDate: hoursFromNow(24 * 10),
        salesEndDate: hoursFromNow(24 * 20),
      }),
      batchBody('Escasso', { totalQuantity: 3 }),
      batchBody('Ultimos', { unitPriceCents: 2_000, totalQuantity: 2 }),
    ]);
    eventId = main.id;
    const [pista, camarote, futuro, escasso, ultimos] = main.batches;
    batches = { pista, camarote, futuro, escasso, ultimos };

    const other = await createEvent('Outro Show', [batchBody('Outro')]);
    otherEventId = other.id;
    otherEventBatch = other.batches[0];

    const draft = await createEvent('Rascunho', [batchBody('Rascunho')], {
      publish: false,
    });
    draftEventId = draft.id;
    draftBatch = draft.batches[0];

    await createCoupon('pct15').expect(201);
    await createCoupon('UMAVEZ', {
      discountType: 'fixed_cents',
      discountValue: 5_000,
      maxUses: 1,
    }).expect(201);
    await createCoupon('TUDOGRATIS', {
      discountType: 'fixed_cents',
      discountValue: 10_000_000,
    }).expect(201);
    await createCoupon('VENCIDO').expect(201);
    await createCoupon('DESLIGADO').expect(201);
    await dataSource.query(
      `UPDATE coupons SET expires_at = now() - interval '1 minute' WHERE event_id = $1 AND code = 'VENCIDO'`,
      [eventId],
    );
    await dataSource.query(
      `UPDATE coupons SET is_active = false WHERE event_id = $1 AND code = 'DESLIGADO'`,
      [eventId],
    );
  });

  afterAll(async () => {
    const users = `SELECT id FROM users WHERE email LIKE 'e2e-${RUN_ID}-%'`;

    // Pedidos primeiro: as FKs de orders para eventos e cupons são RESTRICT.
    await dataSource.query(
      `DELETE FROM orders WHERE customer_id IN (${users})`,
    );
    await dataSource.query(
      `DELETE FROM events WHERE organizer_id IN (${users})`,
    );
    await dataSource.query(`DELETE FROM users WHERE id IN (${users})`);
    await app.close();
  });

  describe('gestão de cupons', () => {
    it('grava o código em maiúsculas e recusa duplicata sem diferenciar caixa', async () => {
      const { body } = await createCoupon('Pct15').expect(409);

      expect(body.error).toBe('COUPON_CODE_ALREADY_EXISTS');
    });

    it('percentual acima de 100% (10000 pontos-base): 400', async () => {
      const { body } = await createCoupon('ALTO', {
        discountValue: 10_001,
      }).expect(400);

      expect(body.error).toBe('INVALID_EVENT_DATA');
    });

    it('cliente e organizador que não é dono não gerenciam cupons', async () => {
      await as(buyer)
        .post(`/events/${eventId}/coupons`)
        .send({
          code: 'X1X',
          discountType: 'percentage',
          discountValue: 1,
          expiresAt: hoursFromNow(5),
        })
        .expect(403);
      const { body } = await as(intruder)
        .get(`/events/${eventId}/coupons`)
        .expect(403);

      expect(body.error).toBe('EVENT_ACCESS_DENIED');
    });

    it('dono lista os cupons com a contagem de uso', async () => {
      const { body } = await as(owner)
        .get(`/events/${eventId}/coupons`)
        .expect(200);

      expect(body.map((coupon: { code: string }) => coupon.code)).toEqual([
        'PCT15',
        'UMAVEZ',
        'TUDOGRATIS',
        'VENCIDO',
        'DESLIGADO',
      ]);
    });
  });

  describe('GET /events/me', () => {
    it('lista os eventos do organizador em qualquer status, com filtro', async () => {
      const all = await as(owner).get('/events/me?limit=100').expect(200);
      const drafts = await as(owner).get('/events/me?status=draft').expect(200);

      const ids = all.body.data.map((event: { id: string }) => event.id);
      expect(ids).toEqual(
        expect.arrayContaining([eventId, otherEventId, draftEventId]),
      );
      expect(drafts.body.data.map((event: { id: string }) => event.id)).toEqual(
        [draftEventId],
      );
    });

    it('não mostra eventos de outro organizador; cliente não acessa', async () => {
      const { body } = await as(intruder).get('/events/me').expect(200);

      expect(body.meta.totalItems).toBe(0);
      await as(buyer).get('/events/me').expect(403);
    });
  });

  describe('reserva (POST /orders)', () => {
    it('sem Idempotency-Key ou com chave inválida: 400', async () => {
      const body = {
        eventId,
        items: [{ batchId: batches.pista.id, quantity: 1 }],
      };

      await as(buyer).post('/orders').send(body).expect(400);
      await placeOrder(buyer, body, 'nao-e-uuid').expect(400);
    });

    it('organizador não compra: 403', async () => {
      await placeOrder(owner, {
        eventId,
        items: [{ batchId: batches.pista.id, quantity: 1 }],
      }).expect(403);
    });

    it('reserva com cupom percentual: totais, prazo de 15 minutos e baixa no estoque', async () => {
      const pistaBefore = await availableOf(batches.pista.id);
      const camaroteBefore = await availableOf(batches.camarote.id);

      const { body } = await placeOrder(buyer, {
        eventId,
        items: [
          { batchId: batches.pista.id, quantity: 2 },
          { batchId: batches.camarote.id, quantity: 1 },
        ],
        couponCode: 'pct15',
      }).expect(201);

      // 2 x 100,00 + 1 x 50,00 = 250,00; 15% = 37,50.
      expect(body).toMatchObject({
        status: 'pending',
        subtotalCents: 25_000,
        discountCents: 3_750,
        totalCents: 21_250,
      });
      expect(
        Math.abs(Date.parse(body.expiresAt) - Date.now() - 15 * 60_000),
      ).toBeLessThan(10_000);
      expect(await availableOf(batches.pista.id)).toBe(pistaBefore - 2);
      expect(await availableOf(batches.camarote.id)).toBe(camaroteBefore - 1);
    });

    describe('idempotência', () => {
      const body = () => ({
        eventId,
        items: [{ batchId: batches.pista.id, quantity: 1 }],
      });

      it('repetir a chave devolve o mesmo pedido com 200, sem baixar estoque de novo', async () => {
        const key = crypto.randomUUID();

        const first = await placeOrder(buyer, body(), key).expect(201);
        const stockAfterFirst = await availableOf(batches.pista.id);
        const retry = await placeOrder(buyer, body(), key).expect(200);

        expect(retry.body.id).toBe(first.body.id);
        expect(retry.headers['idempotent-replayed']).toBe('true');
        expect(await availableOf(batches.pista.id)).toBe(stockAfterFirst);
      });

      it('duplo clique simultâneo: um pedido só, estoque baixado uma vez', async () => {
        const key = crypto.randomUUID();
        const before = await availableOf(batches.pista.id);

        const responses = await Promise.all([
          placeOrder(buyer, body(), key),
          placeOrder(buyer, body(), key),
        ]);

        expect(
          responses.map((response) => response.status).sort((a, b) => a - b),
        ).toEqual([200, 201]);
        expect(responses[0].body.id).toBe(responses[1].body.id);
        expect(await availableOf(batches.pista.id)).toBe(before - 1);
      });

      it('mesma chave com outro conteúdo: 409', async () => {
        const key = crypto.randomUUID();

        await placeOrder(buyer, body(), key).expect(201);
        const { body: error } = await placeOrder(
          buyer,
          { eventId, items: [{ batchId: batches.pista.id, quantity: 2 }] },
          key,
        ).expect(409);

        expect(error.error).toBe('IDEMPOTENCY_KEY_REUSED');
      });
    });

    describe('validações de domínio (422)', () => {
      it.each([
        [
          'mais de 10 ingressos no total',
          () => ({
            eventId,
            items: [
              { batchId: batches.pista.id, quantity: 6 },
              { batchId: batches.camarote.id, quantity: 5 },
            ],
          }),
          'ORDER_TICKET_LIMIT_EXCEEDED',
        ],
        [
          'lote de outro evento',
          () => ({
            eventId,
            items: [
              { batchId: batches.pista.id, quantity: 1 },
              { batchId: otherEventBatch.id, quantity: 1 },
            ],
          }),
          'BATCH_EVENT_MISMATCH',
        ],
        [
          'lote fora do período de vendas',
          () => ({
            eventId,
            items: [{ batchId: batches.futuro.id, quantity: 1 }],
          }),
          'BATCH_SALES_CLOSED',
        ],
        [
          'evento não publicado',
          () => ({
            eventId: draftEventId,
            items: [{ batchId: draftBatch.id, quantity: 1 }],
          }),
          'EVENT_NOT_ON_SALE',
        ],
      ])('%s', async (_, body, code) => {
        const { body: error } = await placeOrder(buyer, body()).expect(422);

        expect(error.error).toBe(code);
      });

      it('lote inexistente: 404', async () => {
        const { body } = await placeOrder(buyer, {
          eventId,
          items: [{ batchId: crypto.randomUUID(), quantity: 1 }],
        }).expect(404);

        expect(body.error).toBe('TICKET_BATCH_NOT_FOUND');
      });

      it('lote repetido no corpo: 400', async () => {
        await placeOrder(buyer, {
          eventId,
          items: [
            { batchId: batches.pista.id, quantity: 1 },
            { batchId: batches.pista.id, quantity: 1 },
          ],
        }).expect(400);
      });

      it('estoque insuficiente num item desfaz a reserva dos outros (rollback)', async () => {
        const pistaBefore = await availableOf(batches.pista.id);

        const { body } = await placeOrder(buyer, {
          eventId,
          items: [
            { batchId: batches.pista.id, quantity: 2 },
            { batchId: batches.escasso.id, quantity: 4 },
          ],
        }).expect(422);

        expect(body.error).toBe('INSUFFICIENT_BATCH_STOCK');
        expect(await availableOf(batches.pista.id)).toBe(pistaBefore);
        expect(await availableOf(batches.escasso.id)).toBe(3);
      });
    });

    describe('cupons na compra', () => {
      const oneTicket = (couponCode: string) => ({
        eventId,
        items: [{ batchId: batches.camarote.id, quantity: 1 }],
        couponCode,
      });

      it.each([
        ['VENCIDO', 'COUPON_EXPIRED'],
        ['DESLIGADO', 'COUPON_INACTIVE'],
        ['NAOEXISTE', 'COUPON_NOT_FOUND'],
      ])('cupom %s: 422 %s', async (code, error) => {
        const { body } = await placeOrder(buyer, oneTicket(code)).expect(422);

        expect(body.error).toBe(error);
      });

      it('cupom de outro evento não vale aqui', async () => {
        await as(owner)
          .post(`/events/${otherEventId}/coupons`)
          .send({
            code: 'SOLADO',
            discountType: 'percentage',
            discountValue: 1000,
            expiresAt: hoursFromNow(48),
          })
          .expect(201);

        const { body } = await placeOrder(buyer, oneTicket('SOLADO')).expect(
          422,
        );

        expect(body.error).toBe('COUPON_NOT_FOUND');
      });

      it('desconto fixo maior que o subtotal zera o total, sem ficar negativo', async () => {
        const { body } = await placeOrder(
          buyer,
          oneTicket('TUDOGRATIS'),
        ).expect(201);

        expect(body).toMatchObject({
          subtotalCents: 5_000,
          discountCents: 5_000,
          totalCents: 0,
        });
      });

      it('cupom esgotado: 422, sem consumir estoque; o cancelamento devolve o uso', async () => {
        const first = await placeOrder(buyer, oneTicket('UMAVEZ')).expect(201);
        const stock = await availableOf(batches.camarote.id);

        const { body } = await placeOrder(
          otherBuyer,
          oneTicket('UMAVEZ'),
        ).expect(422);

        expect(body.error).toBe('COUPON_EXHAUSTED');
        expect(await availableOf(batches.camarote.id)).toBe(stock);
        expect(await usedCountOf('UMAVEZ')).toBe(1);

        await as(buyer).post(`/orders/${first.body.id}/cancel`).expect(200);

        expect(await usedCountOf('UMAVEZ')).toBe(0);
        await placeOrder(otherBuyer, oneTicket('UMAVEZ')).expect(201);
      });
    });
  });

  describe('ciclo de vida do pedido', () => {
    const reserve = async (account: Account = buyer) =>
      (
        await placeOrder(account, {
          eventId,
          items: [{ batchId: batches.pista.id, quantity: 3 }],
          couponCode: 'PCT15',
        }).expect(201)
      ).body as { id: string };

    it('consulta: dono e admin veem; outro cliente não; inexistente é 404', async () => {
      const { id } = await reserve();

      await as(buyer).get(`/orders/${id}`).expect(200);
      await as(admin).get(`/orders/${id}`).expect(200);
      const { body } = await as(otherBuyer).get(`/orders/${id}`).expect(403);
      expect(body.error).toBe('ORDER_ACCESS_DENIED');
      await as(buyer).get(`/orders/${crypto.randomUUID()}`).expect(404);
    });

    it('cancelamento devolve estoque e uso de cupom na mesma transação', async () => {
      const stockBefore = await availableOf(batches.pista.id);
      const usesBefore = await usedCountOf('PCT15');
      const { id } = await reserve();

      await as(otherBuyer).post(`/orders/${id}/cancel`).expect(403);
      const { body } = await as(buyer).post(`/orders/${id}/cancel`).expect(200);

      expect(body.status).toBe('cancelled');
      expect(await availableOf(batches.pista.id)).toBe(stockBefore);
      expect(await usedCountOf('PCT15')).toBe(usesBefore);

      const again = await as(buyer).post(`/orders/${id}/cancel`).expect(422);
      expect(again.body.error).toBe('INVALID_ORDER_STATUS');
    });

    it('admin também cancela pedido de cliente', async () => {
      const { id } = await reserve();

      await as(admin).post(`/orders/${id}/cancel`).expect(200);
    });

    it('pagamento: só o comprador, uma vez, e pedido pago não é cancelado', async () => {
      const { id } = await reserve();

      await as(otherBuyer).post(`/orders/${id}/pay`).expect(403);
      await as(admin).post(`/orders/${id}/pay`).expect(403);
      const { body } = await as(buyer).post(`/orders/${id}/pay`).expect(200);

      expect(body.status).toBe('paid');
      expect(body.paidAt).not.toBeNull();
      expect(
        (await as(buyer).post(`/orders/${id}/pay`).expect(422)).body.error,
      ).toBe('INVALID_ORDER_STATUS');
      await as(buyer).post(`/orders/${id}/cancel`).expect(422);
    });

    it('pagamento depois do prazo: 422 ORDER_EXPIRED; cancelar ainda devolve o estoque', async () => {
      const stockBefore = await availableOf(batches.pista.id);
      const { id } = await reserve();
      await dataSource.query(
        `UPDATE orders SET expires_at = now() - interval '1 minute' WHERE id = $1`,
        [id],
      );

      const { body } = await as(buyer).post(`/orders/${id}/pay`).expect(422);

      expect(body.error).toBe('ORDER_EXPIRED');
      expect((await as(buyer).get(`/orders/${id}`)).body.status).toBe(
        'pending',
      );

      await as(buyer).post(`/orders/${id}/cancel`).expect(200);
      expect(await availableOf(batches.pista.id)).toBe(stockBefore);
    });

    it('GET /orders/me pagina os pedidos do cliente, com filtro por status', async () => {
      const page = await as(buyer).get('/orders/me?limit=1').expect(200);
      const paid = await as(buyer).get('/orders/me?status=paid').expect(200);

      expect(page.body.data).toHaveLength(1);
      expect(page.body.meta.totalItems).toBeGreaterThanOrEqual(2);
      expect(
        paid.body.data.every(
          (order: { status: string }) => order.status === 'paid',
        ),
      ).toBe(true);
      expect(
        paid.body.data.every(
          (order: { customerId: string }) => order.customerId === buyer.userId,
        ),
      ).toBe(true);
    });
  });

  describe('concorrência', () => {
    it('5 clientes disputando os 2 últimos ingressos: 2 pedidos e 3 recusas, sem saldo negativo', async () => {
      const responses = await Promise.all(
        crowd.map((account) =>
          placeOrder(account, {
            eventId,
            items: [{ batchId: batches.ultimos.id, quantity: 1 }],
          }),
        ),
      );

      const created = responses.filter((response) => response.status === 201);
      const rejected = responses.filter((response) => response.status === 422);
      const [{ pending }] = await dataSource.query<{ pending: number }[]>(
        `SELECT count(*)::int AS pending FROM orders o
           JOIN order_items i ON i.order_id = o.id
          WHERE i.batch_id = $1 AND o.status = 'pending'`,
        [batches.ultimos.id],
      );

      expect(created).toHaveLength(2);
      expect(rejected).toHaveLength(3);
      expect(
        rejected.every(
          (response) => response.body.error === 'INSUFFICIENT_BATCH_STOCK',
        ),
      ).toBe(true);
      expect(await availableOf(batches.ultimos.id)).toBe(0);
      expect(pending).toBe(2);
    });
  });
});
