import { Order } from '../../../../domain/entities/order.js';
import { OrderItem } from '../../../../domain/entities/order-item.js';
import type { OrderOrmEntity } from '../entities/order.orm-entity.js';
import type { OrderItemOrmEntity } from '../entities/order-item.orm-entity.js';

// Literais: só colunas entram no INSERT/UPDATE, sem relações.
export type OrderRow = Omit<OrderOrmEntity, 'customer' | 'event' | 'coupon'>;
export type OrderItemRow = Omit<OrderItemOrmEntity, 'order' | 'batch'>;

export const OrderMapper = {
  toDomain(row: OrderOrmEntity, itemRows: OrderItemOrmEntity[]): Order {
    return Order.restore({
      id: row.id,
      customerId: row.customerId,
      eventId: row.eventId,
      couponId: row.couponId,
      status: row.status,
      items: itemRows.map((item) =>
        OrderItem.restore({
          id: item.id,
          batchId: item.batchId,
          quantity: item.quantity,
          unitPriceCents: item.unitPriceCents,
          totalPriceCents: item.totalPriceCents,
        }),
      ),
      subtotalCents: row.subtotalCents,
      discountCents: row.discountCents,
      totalCents: row.totalCents,
      idempotencyKey: row.idempotencyKey,
      requestHash: row.requestHash,
      expiresAt: row.expiresAt,
      paidAt: row.paidAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toRow(order: Order): OrderRow {
    return {
      id: order.id,
      customerId: order.customerId,
      eventId: order.eventId,
      couponId: order.couponId,
      status: order.status,
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      totalCents: order.totalCents,
      idempotencyKey: order.idempotencyKey,
      requestHash: order.requestHash,
      expiresAt: order.expiresAt,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  },

  toItemRows(order: Order): OrderItemRow[] {
    return order.items.map((item) => ({
      id: item.id,
      orderId: order.id,
      batchId: item.batchId,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalPriceCents: item.totalPriceCents,
    }));
  },
};
