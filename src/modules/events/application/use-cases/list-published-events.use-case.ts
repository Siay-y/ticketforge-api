import { Injectable } from '@nestjs/common';
import type {
  Page,
  PageRequest,
} from '../../../../shared/application/pagination.js';
import type { EventSummaryView } from '../dtos/event.views.js';
import { EventCatalog } from '../ports/event-catalog.js';

export interface ListPublishedEventsQuery extends PageRequest {
  search?: string;
  from?: Date;
  to?: Date;
}

@Injectable()
export class ListPublishedEventsUseCase {
  constructor(private readonly catalog: EventCatalog) {}

  /** Sem `from`, só eventos futuros. */
  execute(query: ListPublishedEventsQuery): Promise<Page<EventSummaryView>> {
    return this.catalog.searchPublished({
      ...query,
      search: query.search?.trim() || undefined,
      from: query.from ?? new Date(),
    });
  }
}
