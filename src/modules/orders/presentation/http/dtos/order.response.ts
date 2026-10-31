import { ApiProperty } from '@nestjs/swagger';
import type { Page } from '../../../../../shared/application/pagination.js';
import { PaginationMetaResponse } from '../../../../../shared/presentation/http/pagination.js';
import type {
  OrderItemView,
  OrderView,
} from '../../../application/dtos/order.views.js';
import { OrderStatus } from '../../../domain/value-objects/order-status.js';

export class OrderItemResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  batchId: string;

  @ApiProperty({ example: 2 })
  quantity: number;

  @ApiProperty({
    example: 15000,
    description: 'Preço do lote no momento da compra, em centavos.',
  })
  unitPriceCents: number;

  @ApiProperty({ example: 30000 })
  totalPriceCents: number;

  static from(view: OrderItemView): OrderItemResponse {
    return Object.assign(new OrderItemResponse(), view);
  }
}

export class OrderResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  customerId: string;

  @ApiProperty({ format: 'uuid' })
  eventId: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  couponId: string | null;

  @ApiProperty({
    enum: OrderStatus,
    enumName: 'OrderStatus',
    example: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @ApiProperty({ type: [OrderItemResponse] })
  items: OrderItemResponse[];

  @ApiProperty({ example: 35000 })
  subtotalCents: number;

  @ApiProperty({ example: 5250 })
  discountCents: number;

  @ApiProperty({
    example: 29750,
    description: 'subtotalCents - discountCents; nunca negativo.',
  })
  totalCents: number;

  @ApiProperty({ format: 'uuid' })
  idempotencyKey: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Fim da reserva: 15 minutos após a criação.',
  })
  expiresAt: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  paidAt: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  static from(view: OrderView): OrderResponse {
    return Object.assign(new OrderResponse(), {
      ...view,
      items: view.items.map((item) => OrderItemResponse.from(item)),
    });
  }
}

export class OrderPageResponse {
  @ApiProperty({ type: [OrderResponse] })
  data: OrderResponse[];

  @ApiProperty({ type: PaginationMetaResponse })
  meta: PaginationMetaResponse;

  static from(page: Page<OrderView>): OrderPageResponse {
    return Object.assign(new OrderPageResponse(), {
      data: page.items.map((item) => OrderResponse.from(item)),
      meta: PaginationMetaResponse.from(page),
    });
  }
}
