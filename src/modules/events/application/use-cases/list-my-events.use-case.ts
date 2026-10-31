import { Injectable } from '@nestjs/common';
import type {
  Page,
  PageRequest,
} from '../../../../shared/application/pagination.js';
import type { EventStatus } from '../../domain/value-objects/event-status.js';
import type { EventSummaryView } from '../dtos/event.views.js';
import { EventCatalog } from '../ports/event-catalog.js';
import {
  type Actor,
  assertCanCreateEvents,
} from '../policies/event-access.policy.js';

export interface ListMyEventsQuery extends PageRequest {
  status?: EventStatus;
}

@Injectable()
export class ListMyEventsUseCase {
  constructor(private readonly catalog: EventCatalog) {}

  execute(
    actor: Actor,
    query: ListMyEventsQuery,
  ): Promise<Page<EventSummaryView>> {
    assertCanCreateEvents(actor);

    return this.catalog.searchByOrganizer({
      ...query,
      organizerId: actor.userId,
    });
  }
}
