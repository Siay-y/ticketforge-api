import { Injectable } from '@nestjs/common';
import { EventNotFoundError } from '../../domain/errors/event-not-found.error.js';
import type { EventDetailsView } from '../dtos/event.views.js';
import { EventCatalog } from '../ports/event-catalog.js';

@Injectable()
export class GetPublishedEventUseCase {
  constructor(private readonly catalog: EventCatalog) {}

  /** Evento não publicado responde como inexistente. */
  async execute(slug: string): Promise<EventDetailsView> {
    const event = await this.catalog.findPublishedBySlug(slug);

    if (!event) {
      throw new EventNotFoundError();
    }

    return event;
  }
}
