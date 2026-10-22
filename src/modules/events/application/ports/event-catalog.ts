import type {
  Page,
  PageRequest,
} from '../../../../shared/application/pagination.js';
import type {
  EventDetailsView,
  EventSummaryView,
} from '../dtos/event.views.js';

export interface PublishedEventsQuery extends PageRequest {
  /** Trecho do título ou do local. */
  search?: string;
  from: Date;
  to?: Date;
}

/** Porta de leitura: devolve read models prontos, sem carregar o agregado. */
export abstract class EventCatalog {
  abstract searchPublished(
    query: PublishedEventsQuery,
  ): Promise<Page<EventSummaryView>>;

  abstract findPublishedBySlug(slug: string): Promise<EventDetailsView | null>;
}
