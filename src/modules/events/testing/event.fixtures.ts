import type { CreateEventInput } from '../domain/entities/event.js';
import type { TicketBatchInput } from '../domain/entities/ticket-batch.js';

export const NOW = new Date('2027-01-01T12:00:00.000Z');
export const EVENT_DATE = new Date('2027-03-15T20:00:00.000Z');

const daysAfter = (days: number): Date =>
  new Date(NOW.getTime() + days * 86_400_000);

export const batchInput = (
  overrides: Partial<TicketBatchInput> = {},
): TicketBatchInput => ({
  name: '1º Lote',
  unitPriceCents: 15_000,
  totalQuantity: 100,
  salesStartDate: daysAfter(1),
  salesEndDate: daysAfter(30),
  ...overrides,
});

export const eventInput = (
  overrides: Partial<CreateEventInput> = {},
): CreateEventInput => ({
  organizerId: crypto.randomUUID(),
  title: 'Festival de Verão 2027',
  description: 'Dois dias de música ao ar livre.',
  venue: 'Allianz Parque, São Paulo - SP',
  eventDate: EVENT_DATE,
  maxCapacity: 1_000,
  ...overrides,
});
