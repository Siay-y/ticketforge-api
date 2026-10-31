import { Injectable } from '@nestjs/common';
import { EventRepository } from '../../domain/repositories/event.repository.js';
import {
  type Actor,
  assertCanManage,
} from '../policies/event-access.policy.js';

@Injectable()
export class DeleteEventUseCase {
  constructor(private readonly events: EventRepository) {}

  execute(actor: Actor, eventId: string): Promise<void> {
    return this.events.update(eventId, (event) => {
      assertCanManage(event, actor);
      event.remove(new Date());
    });
  }
}
