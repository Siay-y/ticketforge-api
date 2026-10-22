import { ApiProperty } from '@nestjs/swagger';
import type { Page } from '../../../../../shared/application/pagination.js';
import { PaginationMetaResponse } from '../../../../../shared/presentation/http/pagination.js';
import type {
  EventDetailsView,
  EventSummaryView,
  TicketBatchView,
} from '../../../application/dtos/event.views.js';
import { EventStatus } from '../../../domain/value-objects/event-status.js';

export class TicketBatchResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '1º Lote - Meia-entrada' })
  name: string;

  @ApiProperty({ example: 15000, description: 'Preço unitário em centavos.' })
  unitPriceCents: number;

  @ApiProperty({ example: 500 })
  totalQuantity: number;

  @ApiProperty({ example: 470 })
  availableQuantity: number;

  @ApiProperty({ example: 30 })
  soldQuantity: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2027-01-10T12:00:00.000Z',
  })
  salesStartDate: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2027-02-28T23:59:59.000Z',
  })
  salesEndDate: Date;

  static from(view: TicketBatchView): TicketBatchResponse {
    return Object.assign(new TicketBatchResponse(), view);
  }
}

export class EventSummaryResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'festival-de-verao-2027-3f9a1c2b' })
  slug: string;

  @ApiProperty({ example: 'Festival de Verão 2027' })
  title: string;

  @ApiProperty({ example: 'Allianz Parque, São Paulo - SP' })
  venue: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2027-03-15T20:00:00.000Z',
  })
  eventDate: Date;

  @ApiProperty({
    enum: EventStatus,
    enumName: 'EventStatus',
    example: EventStatus.PUBLISHED,
  })
  status: EventStatus;

  static from(view: EventSummaryView): EventSummaryResponse {
    return Object.assign(new EventSummaryResponse(), {
      id: view.id,
      slug: view.slug,
      title: view.title,
      venue: view.venue,
      eventDate: view.eventDate,
      status: view.status,
    });
  }
}

export class EventDetailsResponse extends EventSummaryResponse {
  @ApiProperty({
    example: 'Dois dias de música ao ar livre com 30 atrações nacionais.',
  })
  description: string;

  @ApiProperty({ example: 10000 })
  maxCapacity: number;

  @ApiProperty({
    example: 2500,
    description: 'Soma de totalQuantity dos lotes; nunca passa de maxCapacity.',
  })
  allocatedQuantity: number;

  @ApiProperty({ format: 'uuid' })
  organizerId: string;

  @ApiProperty({ type: [TicketBatchResponse] })
  batches: TicketBatchResponse[];

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  static override from(view: EventDetailsView): EventDetailsResponse {
    return Object.assign(new EventDetailsResponse(), {
      ...view,
      batches: view.batches.map((batch) => TicketBatchResponse.from(batch)),
    });
  }
}

export class EventPageResponse {
  @ApiProperty({ type: [EventSummaryResponse] })
  data: EventSummaryResponse[];

  @ApiProperty({ type: PaginationMetaResponse })
  meta: PaginationMetaResponse;

  static from(page: Page<EventSummaryView>): EventPageResponse {
    return Object.assign(new EventPageResponse(), {
      data: page.items.map((item) => EventSummaryResponse.from(item)),
      meta: PaginationMetaResponse.from(page),
    });
  }
}
