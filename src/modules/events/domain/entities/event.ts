import { EventCapacityExceededError } from '../errors/event-capacity-exceeded.error.js';
import { EventNotEditableError } from '../errors/event-not-editable.error.js';
import { EventWithoutBatchesError } from '../errors/event-without-batches.error.js';
import { InvalidEventDataError } from '../errors/invalid-event-data.error.js';
import { InvalidEventScheduleError } from '../errors/invalid-event-schedule.error.js';
import { InvalidEventStatusTransitionError } from '../errors/invalid-event-status-transition.error.js';
import { TicketBatchNotFoundError } from '../errors/ticket-batch-not-found.error.js';
import { EventStatus } from '../value-objects/event-status.js';
import { Slug } from '../value-objects/slug.js';
import {
  TicketBatch,
  type TicketBatchChanges,
  type TicketBatchInput,
} from './ticket-batch.js';

export const MAX_EVENT_CAPACITY = 1_000_000;
export const EVENT_TITLE_LENGTH = { min: 3, max: 160 } as const;
export const EVENT_VENUE_LENGTH = { min: 2, max: 200 } as const;
export const MAX_EVENT_DESCRIPTION_LENGTH = 5_000;

const EDITABLE_STATUSES: ReadonlySet<EventStatus> = new Set([
  EventStatus.DRAFT,
  EventStatus.PUBLISHED,
]);

const REMOVABLE_STATUSES: ReadonlySet<EventStatus> = new Set([
  EventStatus.DRAFT,
  EventStatus.CANCELLED,
]);

export interface EventProps {
  id: string;
  organizerId: string;
  title: string;
  slug: Slug;
  description: string;
  venue: string;
  eventDate: Date;
  maxCapacity: number;
  status: EventStatus;
  batches: TicketBatch[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface EventDetailsInput {
  title: string;
  description: string;
  venue: string;
  eventDate: Date;
  maxCapacity: number;
}

export interface CreateEventInput extends EventDetailsInput {
  organizerId: string;
  initialBatches?: TicketBatchInput[];
}

export type EventDetailsChanges = Partial<EventDetailsInput>;

/** Raiz do agregado: lotes só mudam por aqui. */
export class Event {
  private constructor(private props: EventProps) {
    Event.validateDetails(props);
  }

  static create(input: CreateEventInput, now: Date): Event {
    assertFuture(input.eventDate, now);

    const id = crypto.randomUUID();
    const event = new Event({
      id,
      organizerId: input.organizerId,
      title: input.title.trim(),
      slug: Slug.fromTitle(input.title, id),
      description: input.description.trim(),
      venue: input.venue.trim(),
      eventDate: input.eventDate,
      maxCapacity: input.maxCapacity,
      status: EventStatus.DRAFT,
      batches: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    for (const batch of input.initialBatches ?? []) {
      event.addBatch(batch, now);
    }

    return event;
  }

  static restore(props: EventProps): Event {
    return new Event({ ...props, batches: [...props.batches] });
  }

  get id(): string {
    return this.props.id;
  }

  get organizerId(): string {
    return this.props.organizerId;
  }

  get title(): string {
    return this.props.title;
  }

  get slug(): Slug {
    return this.props.slug;
  }

  get description(): string {
    return this.props.description;
  }

  get venue(): string {
    return this.props.venue;
  }

  get eventDate(): Date {
    return this.props.eventDate;
  }

  get maxCapacity(): number {
    return this.props.maxCapacity;
  }

  get status(): EventStatus {
    return this.props.status;
  }

  get batches(): readonly TicketBatch[] {
    return this.props.batches;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get deletedAt(): Date | null {
    return this.props.deletedAt;
  }

  get allocatedQuantity(): number {
    return this.props.batches.reduce(
      (sum, batch) => sum + batch.totalQuantity,
      0,
    );
  }

  updateDetails(changes: EventDetailsChanges, now: Date): void {
    this.assertEditable();

    const next: EventProps = {
      ...this.props,
      title: changes.title?.trim() ?? this.props.title,
      description: changes.description?.trim() ?? this.props.description,
      venue: changes.venue?.trim() ?? this.props.venue,
      eventDate: changes.eventDate ?? this.props.eventDate,
      maxCapacity: changes.maxCapacity ?? this.props.maxCapacity,
      updatedAt: now,
    };

    Event.validateDetails(next);

    if (changes.eventDate) {
      assertFuture(changes.eventDate, now);

      for (const batch of this.props.batches) {
        assertSalesEndWithinEvent(batch.salesEndDate, changes.eventDate);
      }
    }

    assertCapacity(this.allocatedQuantity, next.maxCapacity);
    this.props = next;
  }

  addBatch(input: TicketBatchInput, now: Date): TicketBatch {
    this.assertEditable();

    const batch = TicketBatch.create(this.props.id, input, now);

    assertSalesEndWithinEvent(batch.salesEndDate, this.props.eventDate);
    assertCapacity(
      this.allocatedQuantity + batch.totalQuantity,
      this.props.maxCapacity,
    );

    this.props.batches.push(batch);
    this.props.updatedAt = now;

    return batch;
  }

  updateBatch(
    batchId: string,
    changes: TicketBatchChanges,
    now: Date,
  ): TicketBatch {
    this.assertEditable();

    const batch = this.props.batches.find(({ id }) => id === batchId);

    if (!batch) {
      throw new TicketBatchNotFoundError();
    }

    const totalQuantity = changes.totalQuantity ?? batch.totalQuantity;

    assertCapacity(
      this.allocatedQuantity - batch.totalQuantity + totalQuantity,
      this.props.maxCapacity,
    );
    assertSalesEndWithinEvent(
      changes.salesEndDate ?? batch.salesEndDate,
      this.props.eventDate,
    );

    batch.update(changes, now);
    this.props.updatedAt = now;

    return batch;
  }

  publish(now: Date): void {
    if (this.props.status !== EventStatus.DRAFT) {
      throw new InvalidEventStatusTransitionError(
        'Só eventos em rascunho podem ser publicados',
      );
    }

    if (this.props.batches.length === 0) {
      throw new EventWithoutBatchesError();
    }

    assertFuture(this.props.eventDate, now);
    this.changeStatus(EventStatus.PUBLISHED, now);
  }

  cancel(now: Date): void {
    if (!EDITABLE_STATUSES.has(this.props.status)) {
      throw new InvalidEventStatusTransitionError(
        'Só eventos em rascunho ou publicados podem ser cancelados',
      );
    }

    this.changeStatus(EventStatus.CANCELLED, now);
  }

  remove(now: Date): void {
    if (!REMOVABLE_STATUSES.has(this.props.status)) {
      throw new InvalidEventStatusTransitionError(
        'Só eventos em rascunho ou cancelados podem ser removidos',
      );
    }

    this.props = { ...this.props, deletedAt: now, updatedAt: now };
  }

  private changeStatus(status: EventStatus, now: Date): void {
    this.props = { ...this.props, status, updatedAt: now };
  }

  assertEditable(): void {
    if (!EDITABLE_STATUSES.has(this.props.status)) {
      throw new EventNotEditableError(this.props.status);
    }
  }

  private static validateDetails(props: EventProps): void {
    assertLength('O título', props.title, EVENT_TITLE_LENGTH);
    assertLength('O local', props.venue, EVENT_VENUE_LENGTH);

    if (props.description.length > MAX_EVENT_DESCRIPTION_LENGTH) {
      throw new InvalidEventDataError(
        `A descrição deve ter no máximo ${MAX_EVENT_DESCRIPTION_LENGTH} caracteres`,
      );
    }

    if (
      !Number.isSafeInteger(props.maxCapacity) ||
      props.maxCapacity < 1 ||
      props.maxCapacity > MAX_EVENT_CAPACITY
    ) {
      throw new InvalidEventDataError(
        `A capacidade máxima deve ser um inteiro entre 1 e ${MAX_EVENT_CAPACITY}`,
      );
    }
  }
}

function assertFuture(eventDate: Date, now: Date): void {
  if (eventDate <= now) {
    throw new InvalidEventScheduleError(
      'A data do evento deve estar no futuro',
    );
  }
}

function assertSalesEndWithinEvent(salesEndDate: Date, eventDate: Date): void {
  if (salesEndDate > eventDate) {
    throw new InvalidEventScheduleError(
      'O fim das vendas de um lote não pode ultrapassar a data do evento',
    );
  }
}

function assertCapacity(allocated: number, maxCapacity: number): void {
  if (allocated > maxCapacity) {
    throw new EventCapacityExceededError(allocated, maxCapacity);
  }
}

function assertLength(
  label: string,
  value: string,
  { min, max }: { min: number; max: number },
): void {
  if (value.length < min || value.length > max) {
    throw new InvalidEventDataError(
      `${label} deve ter de ${min} a ${max} caracteres`,
    );
  }
}
