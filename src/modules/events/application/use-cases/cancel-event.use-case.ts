import { Injectable } from '@nestjs/common';
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
export class CancelEventUseCase {
  constructor(private readonly events: EventRepository) {}

  execute(actor: Actor, eventId: string): Promise<EventDetailsView> {
    return this.events.update(eventId, (event) => {
      assertCanManage(event, actor);
      event.cancel(new Date());

      return toEventDetailsView(event);
    });
  }
}
