import { Injectable } from '@nestjs/common';
import type { EventDetailsChanges } from '../../domain/entities/event.js';
import { EventRepository } from '../../domain/repositories/event.repository.js';
import {
  type EventDetailsView,
  toEventDetailsView,
} from '../dtos/event.views.js';
import {
  type Actor,
  assertCanManage,
} from '../policies/event-access.policy.js';

@Injectable()
export class UpdateEventUseCase {
  constructor(private readonly events: EventRepository) {}

  execute(
    actor: Actor,
    eventId: string,
    changes: EventDetailsChanges,
  ): Promise<EventDetailsView> {
    return this.events.update(eventId, (event) => {
      assertCanManage(event, actor);
      event.updateDetails(changes, new Date());

      return toEventDetailsView(event);
    });
  }
}
