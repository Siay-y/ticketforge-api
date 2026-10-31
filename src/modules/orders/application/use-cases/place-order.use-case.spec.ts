import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js';
import type {
  Reservation,
  TicketInventoryService,
} from '../../../events/application/services/ticket-inventory.service.js';
import { UserRole } from '../../../users/domain/value-objects/user-role.js';
import { OrderTicketLimitExceededError } from '../../domain/errors/order-ticket-limit-exceeded.error.js';
import { OrderStatus } from '../../domain/value-objects/order-status.js';
import { InMemoryOrderRepository } from '../../testing/in-memory-order.repository.js';
import { IdempotencyKeyReusedError } from '../errors/idempotency-key-reused.error.js';
import { OrderAccessDeniedError } from '../errors/order-access-denied.error.js';
import type { Actor } from '../policies/order-access.policy.js';
import {
  type PlaceOrderCommand,
  PlaceOrderUseCase,
} from './place-order.use-case.js';

const unitOfWork: UnitOfWork = { run: (work) => work() };

const customer: Actor = {
  userId: crypto.randomUUID(),
  role: UserRole.CUSTOMER,
};
const BATCH_A = '00000000-0000-4000-8000-00000000000a';
const BATCH_B = '00000000-0000-4000-8000-00000000000b';

const command = (
  overrides: Partial<PlaceOrderCommand> = {},
): PlaceOrderCommand => ({
  eventId: crypto.randomUUID(),
  items: [
    { batchId: BATCH_A, quantity: 2 },
    { batchId: BATCH_B, quantity: 1 },
  ],
  couponCode: 'verao15',
  idempotencyKey: crypto.randomUUID(),
  ...overrides,
});

describe('PlaceOrderUseCase', () => {
  let orders: InMemoryOrderRepository;
  let reserve: ReturnType<typeof vi.fn>;
  let placeOrder: PlaceOrderUseCase;

  beforeEach(() => {
    orders = new InMemoryOrderRepository();
    reserve = vi.fn(
      (input: { lines: { batchId: string; quantity: number }[] }) =>
        Promise.resolve<Reservation>({
          lines: input.lines.map((line) => ({
            ...line,
            unitPriceCents: 10_000,
          })),
          couponId: crypto.randomUUID(),
          discountCents: 4_500,
        }),
    );
    placeOrder = new PlaceOrderUseCase(unitOfWork, orders, {
      reserve,
    } as unknown as TicketInventoryService);
  });

  it('cria pedido pendente com os preços e o desconto da reserva', async () => {
    const { order, replayed } = await placeOrder.execute(customer, command());

    expect(replayed).toBe(false);
    expect(order).toMatchObject({
      status: OrderStatus.PENDING,
      customerId: customer.userId,
      subtotalCents: 30_000,
      discountCents: 4_500,
      totalCents: 25_500,
    });
  });

  describe('idempotência', () => {
    it('mesma chave e mesmo corpo devolvem o pedido original sem reservar de novo', async () => {
      const first = command();

      const original = await placeOrder.execute(customer, first);
      const retry = await placeOrder.execute(customer, first);

      expect(retry.replayed).toBe(true);
      expect(retry.order.id).toBe(original.order.id);
      expect(reserve).toHaveBeenCalledTimes(1);
    });

    it('trata como o mesmo pedido itens em outra ordem e cupom em outra caixa', async () => {
      const first = command();
      await placeOrder.execute(customer, first);

      const retry = await placeOrder.execute(customer, {
        ...first,
        items: [...first.items].reverse(),
        couponCode: 'VERAO15',
      });

      expect(retry.replayed).toBe(true);
    });

    it('mesma chave com outro conteúdo é recusada', async () => {
      const first = command();
      await placeOrder.execute(customer, first);

      await expect(
        placeOrder.execute(customer, {
          ...first,
          items: [{ batchId: BATCH_A, quantity: 3 }],
        }),
      ).rejects.toThrow(IdempotencyKeyReusedError);
    });

    it('a mesma chave de outro cliente é um pedido independente', async () => {
      const first = command();
      const other: Actor = { ...customer, userId: crypto.randomUUID() };

      await placeOrder.execute(customer, first);
      const theirs = await placeOrder.execute(other, first);

      expect(theirs.replayed).toBe(false);
      expect(reserve).toHaveBeenCalledTimes(2);
    });

    it('perdeu a corrida no índice único: devolve o pedido vencedor', async () => {
      const first = command();
      const scratch = new InMemoryOrderRepository();
      await new PlaceOrderUseCase(unitOfWork, scratch, {
        reserve,
      } as unknown as TicketInventoryService).execute(customer, first);
      const [winner] = scratch.orders.values();
      orders.raceWinner = winner;

      const result = await placeOrder.execute(customer, first);

      expect(result).toMatchObject({
        replayed: true,
        order: { id: winner.id },
      });
    });
  });

  it('só CUSTOMER compra, e a recusa vem antes de tocar no estoque', async () => {
    const organizer: Actor = { ...customer, role: UserRole.ORGANIZER };

    await expect(placeOrder.execute(organizer, command())).rejects.toThrow(
      OrderAccessDeniedError,
    );
    expect(reserve).not.toHaveBeenCalled();
  });

  it('acima de 10 ingressos é recusado antes de travar qualquer lote', async () => {
    await expect(
      placeOrder.execute(
        customer,
        command({
          items: [
            { batchId: BATCH_A, quantity: 6 },
            { batchId: BATCH_B, quantity: 5 },
          ],
        }),
      ),
    ).rejects.toThrow(OrderTicketLimitExceededError);
    expect(reserve).not.toHaveBeenCalled();
  });
});
