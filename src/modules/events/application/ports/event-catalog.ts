import type {
  Page,
  PageRequest,
} from '../../../../shared/application/pagination.js';
import type {
  EventDetailsView,
  EventSummaryView,
} from '../dtos/event.views.js';
import type { EventStatus } from '../../domain/value-objects/event-status.js';

export interface PublishedEventsQuery extends PageRequest {
  /** Trecho do título ou do local. */
  search?: string;
  from: Date;
  to?: Date;
}

export interface OrganizerEventsQuery extends PageRequest {
  organizerId: string;
  status?: EventStatus;
}

export abstract class EventCatalog {
  abstract searchPublished(
    query: PublishedEventsQuery,
  ): Promise<Page<EventSummaryView>>;

  abstract findPublishedBySlug(slug: string): Promise<EventDetailsView | null>;

  abstract searchByOrganizer(
    query: OrganizerEventsQuery,
  ): Promise<Page<EventSummaryView>>;
}
