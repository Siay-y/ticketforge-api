import { UserRole } from '../../../users/domain/value-objects/user-role.js';
import { OrderAccessDeniedError } from '../errors/order-access-denied.error.js';

export interface Actor {
  userId: string;
  role: UserRole;
}

// Repete o @Roles(): vale mesmo se a rota esquecer.
export function assertCanPlaceOrders(actor: Actor): void {
  if (actor.role !== UserRole.CUSTOMER) {
    throw new OrderAccessDeniedError();
  }
}

export function assertCanAccessOrder(
  order: { customerId: string },
  actor: Actor,
): void {
  if (actor.role !== UserRole.ADMIN && order.customerId !== actor.userId) {
    throw new OrderAccessDeniedError();
  }
}

/** Nem admin paga pelo comprador. */
export function assertIsOrderOwner(
  order: { customerId: string },
  actor: Actor,
): void {
  if (order.customerId !== actor.userId) {
    throw new OrderAccessDeniedError();
  }
}
