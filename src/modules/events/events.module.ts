import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventCatalog } from './application/ports/event-catalog.js';
import { AddTicketBatchUseCase } from './application/use-cases/add-ticket-batch.use-case.js';
import { CancelEventUseCase } from './application/use-cases/cancel-event.use-case.js';
import { CreateEventUseCase } from './application/use-cases/create-event.use-case.js';
import { DeleteEventUseCase } from './application/use-cases/delete-event.use-case.js';
import { GetPublishedEventUseCase } from './application/use-cases/get-published-event.use-case.js';
import { ListPublishedEventsUseCase } from './application/use-cases/list-published-events.use-case.js';
import { PublishEventUseCase } from './application/use-cases/publish-event.use-case.js';
import { UpdateEventUseCase } from './application/use-cases/update-event.use-case.js';
import { UpdateTicketBatchUseCase } from './application/use-cases/update-ticket-batch.use-case.js';
import { EventRepository } from './domain/repositories/event.repository.js';
import { EventOrmEntity } from './infrastructure/persistence/typeorm/entities/event.orm-entity.js';
import { TicketBatchOrmEntity } from './infrastructure/persistence/typeorm/entities/ticket-batch.orm-entity.js';
import { TypeOrmEventCatalog } from './infrastructure/persistence/typeorm/queries/typeorm-event.catalog.js';
import { TypeOrmEventRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-event.repository.js';
import { EventsController } from './presentation/http/controllers/events.controller.js';

@Module({
  imports: [TypeOrmModule.forFeature([EventOrmEntity, TicketBatchOrmEntity])],
  controllers: [EventsController],
  providers: [
    { provide: EventRepository, useClass: TypeOrmEventRepository },
    { provide: EventCatalog, useClass: TypeOrmEventCatalog },
    CreateEventUseCase,
    UpdateEventUseCase,
    PublishEventUseCase,
    CancelEventUseCase,
    DeleteEventUseCase,
    AddTicketBatchUseCase,
    UpdateTicketBatchUseCase,
    ListPublishedEventsUseCase,
    GetPublishedEventUseCase,
  ],
})
export class EventsModule {}
