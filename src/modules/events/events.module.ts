import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventCatalog } from './application/ports/event-catalog.js';
import { TicketInventoryService } from './application/services/ticket-inventory.service.js';
import { AddTicketBatchUseCase } from './application/use-cases/add-ticket-batch.use-case.js';
import { CancelEventUseCase } from './application/use-cases/cancel-event.use-case.js';
import { CreateCouponUseCase } from './application/use-cases/create-coupon.use-case.js';
import { CreateEventUseCase } from './application/use-cases/create-event.use-case.js';
import { DeleteEventUseCase } from './application/use-cases/delete-event.use-case.js';
import { GetPublishedEventUseCase } from './application/use-cases/get-published-event.use-case.js';
import { ListCouponsUseCase } from './application/use-cases/list-coupons.use-case.js';
import { ListMyEventsUseCase } from './application/use-cases/list-my-events.use-case.js';
import { ListPublishedEventsUseCase } from './application/use-cases/list-published-events.use-case.js';
import { PublishEventUseCase } from './application/use-cases/publish-event.use-case.js';
import { UpdateEventUseCase } from './application/use-cases/update-event.use-case.js';
import { UpdateTicketBatchUseCase } from './application/use-cases/update-ticket-batch.use-case.js';
import { CouponRepository } from './domain/repositories/coupon.repository.js';
import { EventRepository } from './domain/repositories/event.repository.js';
import { TicketStockRepository } from './domain/repositories/ticket-stock.repository.js';
import { CouponOrmEntity } from './infrastructure/persistence/typeorm/entities/coupon.orm-entity.js';
import { EventOrmEntity } from './infrastructure/persistence/typeorm/entities/event.orm-entity.js';
import { TicketBatchOrmEntity } from './infrastructure/persistence/typeorm/entities/ticket-batch.orm-entity.js';
import { TypeOrmEventCatalog } from './infrastructure/persistence/typeorm/queries/typeorm-event.catalog.js';
import { TypeOrmCouponRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-coupon.repository.js';
import { TypeOrmEventRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-event.repository.js';
import { TypeOrmTicketStockRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-ticket-stock.repository.js';
import { EventCouponsController } from './presentation/http/controllers/event-coupons.controller.js';
import { EventsController } from './presentation/http/controllers/events.controller.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventOrmEntity,
      TicketBatchOrmEntity,
      CouponOrmEntity,
    ]),
  ],
  controllers: [EventsController, EventCouponsController],
  providers: [
    { provide: EventRepository, useClass: TypeOrmEventRepository },
    { provide: EventCatalog, useClass: TypeOrmEventCatalog },
    { provide: CouponRepository, useClass: TypeOrmCouponRepository },
    { provide: TicketStockRepository, useClass: TypeOrmTicketStockRepository },
    TicketInventoryService,
    CreateEventUseCase,
    UpdateEventUseCase,
    PublishEventUseCase,
    CancelEventUseCase,
    DeleteEventUseCase,
    AddTicketBatchUseCase,
    UpdateTicketBatchUseCase,
    ListPublishedEventsUseCase,
    GetPublishedEventUseCase,
    ListMyEventsUseCase,
    CreateCouponUseCase,
    ListCouponsUseCase,
  ],
  // Exporta só o serviço de estoque, nunca os repositórios.
  exports: [TicketInventoryService],
})
export class EventsModule {}
