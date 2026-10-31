import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/application/unit-of-work.js';
import {
  type StockLine,
  TicketInventoryService,
} from '../../../events/application/services/ticket-inventory.service.js';
import { Order } from '../../domain/entities/order.js';
import { DuplicateIdempotencyKeyError } from '../../domain/errors/duplicate-idempotency-key.error.js';
import { OrderRepository } from '../../domain/repositories/order.repository.js';
import { type OrderView, toOrderView } from '../dtos/order.views.js';
import { IdempotencyKeyReusedError } from '../errors/idempotency-key-reused.error.js';
import {
  type Actor,
  assertCanPlaceOrders,
} from '../policies/order-access.policy.js';

export interface PlaceOrderCommand {
  eventId: string;
  items: StockLine[];
  couponCode?: string;
  idempotencyKey: string;
}

export interface PlaceOrderResult {
  order: OrderView;
  /** A chave já tinha pedido: nada foi reservado de novo. */
  replayed: boolean;
}

@Injectable()
export class PlaceOrderUseCase {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly orders: OrderRepository,
    private readonly inventory: TicketInventoryService,
  ) {}

  async execute(
    actor: Actor,
    command: PlaceOrderCommand,
  ): Promise<PlaceOrderResult> {
    assertCanPlaceOrders(actor);
    Order.assertWithinTicketLimit(command.items);

    const requestHash = fingerprint(command);

    try {
      return await this.unitOfWork.run(async () => {
        // Duplo clique: a segunda requisição espera aqui e encontra o pedido da primeira.
        await this.orders.acquireIdempotencyLock(
          actor.userId,
          command.idempotencyKey,
        );

        const existing = await this.orders.findByIdempotencyKey(
          actor.userId,
          command.idempotencyKey,
        );

        if (existing) {
          return replay(existing, requestHash);
        }

        const now = new Date();
        const reservation = await this.inventory.reserve(
          {
            eventId: command.eventId,
            lines: command.items,
            couponCode: command.couponCode,
          },
          now,
        );
        const order = Order.place(
          {
            customerId: actor.userId,
            eventId: command.eventId,
            idempotencyKey: command.idempotencyKey,
            requestHash,
            lines: reservation.lines,
            couponId: reservation.couponId,
            discountCents: reservation.discountCents,
          },
          now,
        );

        await this.orders.create(order);

        return { order: toOrderView(order), replayed: false };
      });
    } catch (error) {
      // Rede de segurança do índice único: a transação perdedora já foi desfeita.
      if (error instanceof DuplicateIdempotencyKeyError) {
        const winner = await this.orders.findByIdempotencyKey(
          actor.userId,
          command.idempotencyKey,
        );

        if (winner) {
          return replay(winner, requestHash);
        }
      }

      throw error;
    }
  }
}

function replay(order: Order, requestHash: string): PlaceOrderResult {
  if (order.requestHash !== requestHash) {
    throw new IdempotencyKeyReusedError();
  }

  return { order: toOrderView(order), replayed: true };
}

/** Canônico: ordem dos itens e caixa do cupom não mudam o hash. */
function fingerprint(command: PlaceOrderCommand): string {
  const canonical = JSON.stringify({
    eventId: command.eventId,
    items: [...command.items]
      .sort((a, b) => a.batchId.localeCompare(b.batchId))
      .map(({ batchId, quantity }) => [batchId, quantity]),
    couponCode: command.couponCode?.trim().toUpperCase() ?? null,
  });

  return createHash('sha256').update(canonical).digest('hex');
}
