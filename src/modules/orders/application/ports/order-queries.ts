import type {
  Page,
  PageRequest,
} from '../../../../shared/application/pagination.js';
import type { OrderStatus } from '../../domain/value-objects/order-status.js';
import type { OrderView } from '../dtos/order.views.js';

export interface CustomerOrdersQuery extends PageRequest {
  customerId: string;
  status?: OrderStatus;
}

export abstract class OrderQueries {
  abstract findById(orderId: string): Promise<OrderView | null>;

  abstract listByCustomer(query: CustomerOrdersQuery): Promise<Page<OrderView>>;
}
