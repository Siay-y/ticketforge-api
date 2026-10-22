import { Injectable } from '@nestjs/common';
import type { TicketBatchChanges } from '../../domain/entities/ticket-batch.js';
import { EventRepository } from '../../domain/repositories/event.repository.js';
import {
  type TicketBatchView,
  toTicketBatchView,
} from '../dtos/event.views.js';
import {
  type Actor,
  assertCanManage,
} from '../policies/event-access.policy.js';

@Injectable()
export class UpdateTicketBatchUseCase {
  constructor(private readonly events: EventRepository) {}

  execute(
    actor: Actor,
    eventId: string,
    batchId: string,
    changes: TicketBatchChanges,
  ): Promise<TicketBatchView> {
    return this.events.update(eventId, (event) => {
      assertCanManage(event, actor);

      return toTicketBatchView(event.updateBatch(batchId, changes, new Date()));
    });
  }
}
