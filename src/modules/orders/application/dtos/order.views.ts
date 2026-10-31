import type { Order } from '../../domain/entities/order.js';
import type { OrderStatus } from '../../domain/value-objects/order-status.js';

export interface OrderItemView {
  id: string;
  batchId: string;
  quantity: number;
  unitPriceCents: number;
  totalPriceCents: number;
}

export interface OrderView {
  id: string;
  customerId: string;
  eventId: string;
  couponId: string | null;
  status: OrderStatus;
  items: OrderItemView[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  idempotencyKey: string;
  expiresAt: Date;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const toOrderView = (order: Order): OrderView => ({
  id: order.id,
  customerId: order.customerId,
  eventId: order.eventId,
  couponId: order.couponId,
  status: order.status,
  items: order.items.map((item) => ({
    id: item.id,
    batchId: item.batchId,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    totalPriceCents: item.totalPriceCents,
  })),
  subtotalCents: order.subtotalCents,
  discountCents: order.discountCents,
  totalCents: order.totalCents,
  idempotencyKey: order.idempotencyKey,
  expiresAt: order.expiresAt,
  paidAt: order.paidAt,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});
