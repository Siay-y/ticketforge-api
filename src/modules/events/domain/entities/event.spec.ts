import {
  batchInput,
  EVENT_DATE,
  eventInput,
  NOW,
} from '../../testing/event.fixtures.js';
import { EventCapacityExceededError } from '../errors/event-capacity-exceeded.error.js';
import { EventNotEditableError } from '../errors/event-not-editable.error.js';
import { EventWithoutBatchesError } from '../errors/event-without-batches.error.js';
import { InvalidEventScheduleError } from '../errors/invalid-event-schedule.error.js';
import { InvalidEventStatusTransitionError } from '../errors/invalid-event-status-transition.error.js';
import { TicketBatchNotFoundError } from '../errors/ticket-batch-not-found.error.js';
import { EventStatus } from '../value-objects/event-status.js';
import { Event } from './event.js';

const LATER = new Date(NOW.getTime() + 60_000);

describe('Event', () => {
  describe('criação', () => {
    it('nasce em rascunho, com slug derivado do título', () => {
      const event = Event.create(eventInput(), NOW);

      expect(event.status).toBe(EventStatus.DRAFT);
      expect(event.slug.value).toMatch(/^festival-de-verao-2027-[0-9a-f]{8}$/);
      expect(event.deletedAt).toBeNull();
    });

    it('recusa data do evento no passado ou agora', () => {
      expect(() => Event.create(eventInput({ eventDate: NOW }), NOW)).toThrow(
        InvalidEventScheduleError,
      );
    });

    it('aceita lotes iniciais dentro da capacidade', () => {
      const event = Event.create(
        eventInput({
          maxCapacity: 300,
          initialBatches: [
            batchInput({ totalQuantity: 200 }),
            batchInput({ totalQuantity: 100 }),
          ],
        }),
        NOW,
      );

      expect(event.batches).toHaveLength(2);
      expect(event.allocatedQuantity).toBe(300);
    });

    it('recusa o conjunto se a soma dos lotes iniciais passar da capacidade', () => {
      expect(() =>
        Event.create(
          eventInput({
            maxCapacity: 300,
            initialBatches: [
              batchInput({ totalQuantity: 200 }),
              batchInput({ totalQuantity: 101 }),
            ],
          }),
          NOW,
        ),
      ).toThrow(EventCapacityExceededError);
    });

    it('recusa lote cujas vendas terminam depois do evento', () => {
      expect(() =>
        Event.create(
          eventInput({
            initialBatches: [
              batchInput({ salesEndDate: new Date(EVENT_DATE.getTime() + 1) }),
            ],
          }),
          NOW,
        ),
      ).toThrow(InvalidEventScheduleError);
    });

    it('aceita vendas terminando exatamente na hora do evento', () => {
      const event = Event.create(
        eventInput({
          initialBatches: [batchInput({ salesEndDate: EVENT_DATE })],
        }),
        NOW,
      );

      expect(event.batches).toHaveLength(1);
    });
  });

  describe('lotes', () => {
    it('adiciona lote enquanto houver capacidade', () => {
      const event = Event.create(eventInput({ maxCapacity: 150 }), NOW);

      event.addBatch(batchInput({ totalQuantity: 100 }), LATER);
      event.addBatch(batchInput({ totalQuantity: 50 }), LATER);

      expect(event.allocatedQuantity).toBe(150);
      expect(event.updatedAt).toEqual(LATER);
    });

    it('recusa lote que estoura a capacidade e mantém os anteriores', () => {
      const event = Event.create(eventInput({ maxCapacity: 150 }), NOW);
      event.addBatch(batchInput({ totalQuantity: 100 }), LATER);

      expect(() =>
        event.addBatch(batchInput({ totalQuantity: 51 }), LATER),
      ).toThrow(EventCapacityExceededError);
      expect(event.batches).toHaveLength(1);
    });

    it('aumentar um lote conta a diferença, não a soma dobrada', () => {
      const event = Event.create(eventInput({ maxCapacity: 150 }), NOW);
      const batch = event.addBatch(batchInput({ totalQuantity: 100 }), LATER);

      event.updateBatch(batch.id, { totalQuantity: 150 }, LATER);

      expect(event.allocatedQuantity).toBe(150);
      expect(() =>
        event.updateBatch(batch.id, { totalQuantity: 151 }, LATER),
      ).toThrow(EventCapacityExceededError);
    });

    it('recusa estender as vendas de um lote para depois do evento', () => {
      const event = Event.create(eventInput(), NOW);
      const batch = event.addBatch(batchInput(), LATER);

      expect(() =>
        event.updateBatch(
          batch.id,
          { salesEndDate: new Date(EVENT_DATE.getTime() + 1) },
          LATER,
        ),
      ).toThrow(InvalidEventScheduleError);
    });

    it('responde lote inexistente', () => {
      const event = Event.create(eventInput(), NOW);

      expect(() =>
        event.updateBatch(crypto.randomUUID(), { name: 'x' }, LATER),
      ).toThrow(TicketBatchNotFoundError);
    });
  });

  describe('alteração de dados', () => {
    it('recusa reduzir a capacidade abaixo do já distribuído', () => {
      const event = Event.create(
        eventInput({
          maxCapacity: 300,
          initialBatches: [batchInput({ totalQuantity: 200 })],
        }),
        NOW,
      );

      expect(() => event.updateDetails({ maxCapacity: 199 }, LATER)).toThrow(
        EventCapacityExceededError,
      );
      expect(event.maxCapacity).toBe(300);
    });

    it('recusa antecipar o evento para antes do fim das vendas de um lote', () => {
      const event = Event.create(
        eventInput({ initialBatches: [batchInput()] }),
        NOW,
      );
      const beforeSalesEnd = new Date(
        event.batches[0].salesEndDate.getTime() - 1,
      );

      expect(() =>
        event.updateDetails({ eventDate: beforeSalesEnd }, LATER),
      ).toThrow(InvalidEventScheduleError);
    });

    it('mantém o slug quando o título muda', () => {
      const event = Event.create(eventInput(), NOW);
      const slug = event.slug.value;

      event.updateDetails({ title: 'Outro Nome' }, LATER);

      expect(event.title).toBe('Outro Nome');
      expect(event.slug.value).toBe(slug);
    });
  });

  describe('ciclo de vida', () => {
    it('publica rascunho com lote e data futura', () => {
      const event = Event.create(
        eventInput({ initialBatches: [batchInput()] }),
        NOW,
      );

      event.publish(LATER);

      expect(event.status).toBe(EventStatus.PUBLISHED);
    });

    it('não publica evento sem lotes', () => {
      const event = Event.create(eventInput(), NOW);

      expect(() => event.publish(LATER)).toThrow(EventWithoutBatchesError);
    });

    it('não publica duas vezes', () => {
      const event = Event.create(
        eventInput({ initialBatches: [batchInput()] }),
        NOW,
      );
      event.publish(LATER);

      expect(() => event.publish(LATER)).toThrow(
        InvalidEventStatusTransitionError,
      );
    });

    it('não publica se a data do evento já passou', () => {
      const event = Event.create(
        eventInput({ initialBatches: [batchInput()] }),
        NOW,
      );

      expect(() => event.publish(new Date(EVENT_DATE.getTime() + 1))).toThrow(
        InvalidEventScheduleError,
      );
    });

    it('evento cancelado não aceita alterações nem novos lotes', () => {
      const event = Event.create(eventInput(), NOW);
      event.cancel(LATER);

      expect(() => event.updateDetails({ title: 'Novo' }, LATER)).toThrow(
        EventNotEditableError,
      );
      expect(() => event.addBatch(batchInput(), LATER)).toThrow(
        EventNotEditableError,
      );
    });

    it('remove rascunho ou cancelado, mas não publicado', () => {
      const draft = Event.create(eventInput(), NOW);
      const published = Event.create(
        eventInput({ initialBatches: [batchInput()] }),
        NOW,
      );
      published.publish(LATER);

      draft.remove(LATER);

      expect(draft.deletedAt).toEqual(LATER);
      expect(() => published.remove(LATER)).toThrow(
        InvalidEventStatusTransitionError,
      );

      published.cancel(LATER);
      published.remove(LATER);
      expect(published.deletedAt).toEqual(LATER);
    });
  });
});
