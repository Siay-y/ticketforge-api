import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, type Repository } from 'typeorm';
import {
  offsetOf,
  type Page,
  toPage,
} from '../../../../../../shared/application/pagination.js';
import {
  type EventDetailsView,
  type EventSummaryView,
  toEventDetailsView,
} from '../../../../application/dtos/event.views.js';
import type {
  EventCatalog,
  PublishedEventsQuery,
} from '../../../../application/ports/event-catalog.js';
import { EventStatus } from '../../../../domain/value-objects/event-status.js';
import { EventOrmEntity } from '../entities/event.orm-entity.js';
import { TicketBatchOrmEntity } from '../entities/ticket-batch.orm-entity.js';
import { EventMapper } from '../mappers/event.mapper.js';

@Injectable()
export class TypeOrmEventCatalog implements EventCatalog {
  constructor(
    @InjectRepository(EventOrmEntity)
    private readonly events: Repository<EventOrmEntity>,
    @InjectRepository(TicketBatchOrmEntity)
    private readonly batches: Repository<TicketBatchOrmEntity>,
  ) {}

  async searchPublished(
    query: PublishedEventsQuery,
  ): Promise<Page<EventSummaryView>> {
    // Removidos (deleted_at) ficam de fora automaticamente pelo @DeleteDateColumn.
    const builder = this.events
      .createQueryBuilder('event')
      .where('event.status = :status', { status: EventStatus.PUBLISHED })
      .andWhere('event.eventDate >= :from', { from: query.from });

    if (query.to) {
      builder.andWhere('event.eventDate <= :to', { to: query.to });
    }

    if (query.search) {
      const term = `%${escapeLike(query.search)}%`;

      builder.andWhere(
        new Brackets((where) =>
          where
            .where("event.title ILIKE :term ESCAPE '\\'", { term })
            .orWhere("event.venue ILIKE :term ESCAPE '\\'", { term }),
        ),
      );
    }

    const [rows, totalItems] = await builder
      .orderBy('event.eventDate', 'ASC')
      .addOrderBy('event.id', 'ASC')
      .offset(offsetOf(query))
      .limit(query.limit)
      .getManyAndCount();

    return toPage(rows.map(toSummaryView), totalItems, query);
  }

  async findPublishedBySlug(slug: string): Promise<EventDetailsView | null> {
    const row = await this.events.findOneBy({
      slug,
      status: EventStatus.PUBLISHED,
    });

    if (!row) {
      return null;
    }

    const batchRows = await this.batches.find({
      where: { eventId: row.id },
      order: { salesStartDate: 'ASC', createdAt: 'ASC' },
    });

    return toEventDetailsView(EventMapper.toDomain(row, batchRows));
  }
}

const toSummaryView = (row: EventOrmEntity): EventSummaryView => ({
  id: row.id,
  slug: row.slug,
  title: row.title,
  venue: row.venue,
  eventDate: row.eventDate,
  status: row.status,
});

// O termo do usuário é literal: % e _ não podem virar curingas do LIKE.
const escapeLike = (value: string): string =>
  value.replace(/[\\%_]/g, (char) => `\\${char}`);
