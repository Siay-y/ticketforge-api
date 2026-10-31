import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import {
  offsetOf,
  type Page,
  toPage,
} from '../../../../../../shared/application/pagination.js';
import {
  type OrderView,
  toOrderView,
} from '../../../../application/dtos/order.views.js';
import type {
  CustomerOrdersQuery,
  OrderQueries,
} from '../../../../application/ports/order-queries.js';
import { OrderOrmEntity } from '../entities/order.orm-entity.js';
import { OrderItemOrmEntity } from '../entities/order-item.orm-entity.js';
import { OrderMapper } from '../mappers/order.mapper.js';

@Injectable()
export class TypeOrmOrderQueries implements OrderQueries {
  constructor(
    @InjectRepository(OrderOrmEntity)
    private readonly orders: Repository<OrderOrmEntity>,
    @InjectRepository(OrderItemOrmEntity)
    private readonly items: Repository<OrderItemOrmEntity>,
  ) {}

  async findById(orderId: string): Promise<OrderView | null> {
    const row = await this.orders.findOneBy({ id: orderId });

    if (!row) {
      return null;
    }

    const [view] = await this.toViews([row]);

    return view;
  }

  async listByCustomer(query: CustomerOrdersQuery): Promise<Page<OrderView>> {
    // O TypeORM 1.x recusa `undefined` no where.
    const [rows, totalItems] = await this.orders.findAndCount({
      where: {
        customerId: query.customerId,
        ...(query.status && { status: query.status }),
      },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: offsetOf(query),
      take: query.limit,
    });

    return toPage(await this.toViews(rows), totalItems, query);
  }

  /** Itens da página numa só consulta (sem N+1). */
  private async toViews(rows: OrderOrmEntity[]): Promise<OrderView[]> {
    if (rows.length === 0) {
      return [];
    }

    const items = await this.items.find({
      where: { orderId: In(rows.map((row) => row.id)) },
      order: { batchId: 'ASC' },
    });

    return rows.map((row) =>
      toOrderView(
        OrderMapper.toDomain(
          row,
          items.filter((item) => item.orderId === row.id),
        ),
      ),
    );
  }
}
