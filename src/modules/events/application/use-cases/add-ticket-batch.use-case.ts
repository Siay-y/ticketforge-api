import { Injectable } from '@nestjs/common';
import type { TicketBatchInput } from '../../domain/entities/ticket-batch.js';
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
export class AddTicketBatchUseCase {
  constructor(private readonly events: EventRepository) {}

  /** O lock do evento serializa inclusões simultâneas: a soma de capacidade nunca é lida desatualizada. */
  execute(
    actor: Actor,
    eventId: string,
    input: TicketBatchInput,
  ): Promise<TicketBatchView> {
    return this.events.update(eventId, (event) => {
      assertCanManage(event, actor);

      return toTicketBatchView(event.addBatch(input, new Date()));
    });
  }
}
