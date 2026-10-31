import { InvalidOrderStatusError } from '../errors/invalid-order-status.error.js';
import { OrderExpiredError } from '../errors/order-expired.error.js';
import { OrderTicketLimitExceededError } from '../errors/order-ticket-limit-exceeded.error.js';
import { OrderStatus } from '../value-objects/order-status.js';
import { Order, type PlaceOrderInput } from './order.js';

const NOW = new Date('2027-01-01T12:00:00.000Z');
const minutesAfter = (minutes: number) =>
  new Date(NOW.getTime() + minutes * 60_000);

const input = (overrides: Partial<PlaceOrderInput> = {}): PlaceOrderInput => ({
  customerId: crypto.randomUUID(),
  eventId: crypto.randomUUID(),
  idempotencyKey: crypto.randomUUID(),
  requestHash: 'a'.repeat(64),
  lines: [
    { batchId: crypto.randomUUID(), quantity: 2, unitPriceCents: 15_000 },
    { batchId: crypto.randomUUID(), quantity: 1, unitPriceCents: 5_000 },
  ],
  couponId: null,
  discountCents: 0,
  ...overrides,
});

describe('Order', () => {
  it('nasce pendente, com totais calculados e reserva de 15 minutos', () => {
    const order = Order.place(input({ discountCents: 5_250 }), NOW);

    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.subtotalCents).toBe(35_000);
    expect(order.discountCents).toBe(5_250);
    expect(order.totalCents).toBe(29_750);
    expect(order.items.map((item) => item.totalPriceCents)).toEqual([
      30_000, 5_000,
    ]);
    expect(order.expiresAt).toEqual(minutesAfter(15));
    expect(order.paidAt).toBeNull();
  });

  it('aceita exatamente o limite de 10 ingressos e recusa o 11º', () => {
    const line = (quantity: number) => ({
      batchId: crypto.randomUUID(),
      quantity,
      unitPriceCents: 100,
    });

    expect(() =>
      Order.place(input({ lines: [line(6), line(4)] }), NOW),
    ).not.toThrow();
    expect(() =>
      Order.place(input({ lines: [line(6), line(5)] }), NOW),
    ).toThrow(OrderTicketLimitExceededError);
  });

  it('recusa desconto maior que o subtotal', () => {
    expect(() => Order.place(input({ discountCents: 35_001 }), NOW)).toThrow();
  });

  describe('pagamento', () => {
    it('paga dentro do prazo, inclusive no último instante', () => {
      const order = Order.place(input(), NOW);

      order.pay(minutesAfter(15));

      expect(order.status).toBe(OrderStatus.PAID);
      expect(order.paidAt).toEqual(minutesAfter(15));
    });

    it('recusa pagamento depois do prazo com ORDER_EXPIRED', () => {
      const order = Order.place(input(), NOW);

      expect(() => order.pay(new Date(minutesAfter(15).getTime() + 1))).toThrow(
        OrderExpiredError,
      );
      expect(order.status).toBe(OrderStatus.PENDING);
    });

    it('não paga duas vezes', () => {
      const order = Order.place(input(), NOW);
      order.pay(NOW);

      expect(() => order.pay(NOW)).toThrow(InvalidOrderStatusError);
    });
  });

  describe('cancelamento', () => {
    it('cancela pendente, inclusive já vencido', () => {
      const order = Order.place(input(), NOW);

      order.cancel(minutesAfter(60));

      expect(order.status).toBe(OrderStatus.CANCELLED);
    });

    it('não cancela pedido pago nem já cancelado', () => {
      const paid = Order.place(input(), NOW);
      const cancelled = Order.place(input(), NOW);
      paid.pay(NOW);
      cancelled.cancel(NOW);

      expect(() => paid.cancel(NOW)).toThrow(InvalidOrderStatusError);
      expect(() => cancelled.cancel(NOW)).toThrow(InvalidOrderStatusError);
    });

    it('pedido cancelado não pode ser pago', () => {
      const order = Order.place(input(), NOW);
      order.cancel(NOW);

      expect(() => order.pay(NOW)).toThrow(InvalidOrderStatusError);
    });
  });
});
