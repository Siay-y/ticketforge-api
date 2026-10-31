import { Injectable } from '@nestjs/common';
import { Event, type EventDetailsInput } from '../../domain/entities/event.js';
import type { TicketBatchInput } from '../../domain/entities/ticket-batch.js';
import { EventRepository } from '../../domain/repositories/event.repository.js';
import {
  type EventDetailsView,
  toEventDetailsView,
} from '../dtos/event.views.js';
import {
  type Actor,
  assertCanCreateEvents,
} from '../policies/event-access.policy.js';

export interface CreateEventCommand extends EventDetailsInput {
  initialBatches?: TicketBatchInput[];
}

@Injectable()
export class CreateEventUseCase {
  constructor(private readonly events: EventRepository) {}

  async execute(
    actor: Actor,
    command: CreateEventCommand,
  ): Promise<EventDetailsView> {
    assertCanCreateEvents(actor);

    const event = Event.create(
      { ...command, organizerId: actor.userId },
      new Date(),
    );

    await this.events.create(event);

    return toEventDetailsView(event);
  }
}
