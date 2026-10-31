import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../events/events.module.js';
import { OrderQueries } from './application/ports/order-queries.js';
import { CancelOrderUseCase } from './application/use-cases/cancel-order.use-case.js';
import { GetOrderUseCase } from './application/use-cases/get-order.use-case.js';
import { ListMyOrdersUseCase } from './application/use-cases/list-my-orders.use-case.js';
import { PayOrderUseCase } from './application/use-cases/pay-order.use-case.js';
import { PlaceOrderUseCase } from './application/use-cases/place-order.use-case.js';
import { OrderRepository } from './domain/repositories/order.repository.js';
import { OrderOrmEntity } from './infrastructure/persistence/typeorm/entities/order.orm-entity.js';
import { OrderItemOrmEntity } from './infrastructure/persistence/typeorm/entities/order-item.orm-entity.js';
import { TypeOrmOrderQueries } from './infrastructure/persistence/typeorm/queries/typeorm-order.queries.js';
import { TypeOrmOrderRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-order.repository.js';
import { OrdersController } from './presentation/http/controllers/orders.controller.js';

@Module({
  imports: [
    EventsModule,
    TypeOrmModule.forFeature([OrderOrmEntity, OrderItemOrmEntity]),
  ],
  controllers: [OrdersController],
  providers: [
    { provide: OrderRepository, useClass: TypeOrmOrderRepository },
    { provide: OrderQueries, useClass: TypeOrmOrderQueries },
    PlaceOrderUseCase,
    PayOrderUseCase,
    CancelOrderUseCase,
    GetOrderUseCase,
    ListMyOrdersUseCase,
  ],
})
export class OrdersModule {}
