import { Injectable } from '@nestjs/common';
import type {
  Page,
  PageRequest,
} from '../../../../shared/application/pagination.js';
import type { OrderStatus } from '../../domain/value-objects/order-status.js';
import type { OrderView } from '../dtos/order.views.js';
import { OrderQueries } from '../ports/order-queries.js';
import type { Actor } from '../policies/order-access.policy.js';

export interface ListMyOrdersQuery extends PageRequest {
  status?: OrderStatus;
}

@Injectable()
export class ListMyOrdersUseCase {
  constructor(private readonly queries: OrderQueries) {}

  execute(actor: Actor, query: ListMyOrdersQuery): Promise<Page<OrderView>> {
    return this.queries.listByCustomer({ ...query, customerId: actor.userId });
  }
}
