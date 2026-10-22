import { batchInput, NOW } from '../../testing/event.fixtures.js';
import { InvalidEventDataError } from '../errors/invalid-event-data.error.js';
import { InvalidEventScheduleError } from '../errors/invalid-event-schedule.error.js';
import { TicketBatchQuantityBelowSoldError } from '../errors/ticket-batch-quantity-below-sold.error.js';
import { TicketBatch } from './ticket-batch.js';

const LATER = new Date(NOW.getTime() + 60_000);

const withSales = (total: number, sold: number): TicketBatch => {
  const batch = TicketBatch.create(
    crypto.randomUUID(),
    batchInput({ totalQuantity: total }),
    NOW,
  );

  return TicketBatch.restore({
    id: batch.id,
    eventId: batch.eventId,
    name: batch.name,
    unitPriceCents: batch.unitPriceCents,
    totalQuantity: total,
    availableQuantity: total - sold,
    salesStartDate: batch.salesStartDate,
    salesEndDate: batch.salesEndDate,
    createdAt: NOW,
    updatedAt: NOW,
  });
};

describe('TicketBatch', () => {
  it('nasce com todo o estoque disponível', () => {
    const batch = TicketBatch.create(crypto.randomUUID(), batchInput(), NOW);

    expect(batch.availableQuantity).toBe(100);
    expect(batch.soldQuantity).toBe(0);
  });

  it('exige início das vendas anterior ao fim', () => {
    const at = new Date('2027-02-01T00:00:00Z');

    expect(() =>
      TicketBatch.create(
        crypto.randomUUID(),
        batchInput({ salesStartDate: at, salesEndDate: at }),
        NOW,
      ),
    ).toThrow(InvalidEventScheduleError);
  });

  it.each([
    ['preço fracionário', { unitPriceCents: 150.5 }],
    ['preço negativo', { unitPriceCents: -1 }],
    ['quantidade zero', { totalQuantity: 0 }],
    ['nome vazio', { name: '   ' }],
  ])('recusa %s', (_, overrides) => {
    expect(() =>
      TicketBatch.create(crypto.randomUUID(), batchInput(overrides), NOW),
    ).toThrow(InvalidEventDataError);
  });

  it('aceita lote gratuito', () => {
    expect(
      TicketBatch.create(
        crypto.randomUUID(),
        batchInput({ unitPriceCents: 0 }),
        NOW,
      ).unitPriceCents,
    ).toBe(0);
  });

  describe('imutabilidade do vendido', () => {
    it('não deixa reduzir o total abaixo do já vendido', () => {
      const batch = withSales(100, 30);

      expect(() => batch.update({ totalQuantity: 29 }, LATER)).toThrow(
        TicketBatchQuantityBelowSoldError,
      );
      expect(batch.totalQuantity).toBe(100);
    });

    it('reduzir até o vendido zera o disponível e preserva as vendas', () => {
      const batch = withSales(100, 30);

      batch.update({ totalQuantity: 30 }, LATER);

      expect(batch.availableQuantity).toBe(0);
      expect(batch.soldQuantity).toBe(30);
    });

    it('aumentar o total soma só no disponível', () => {
      const batch = withSales(100, 30);

      batch.update({ totalQuantity: 150 }, LATER);

      expect(batch.availableQuantity).toBe(120);
      expect(batch.soldQuantity).toBe(30);
    });
  });

  it('atualização inválida não altera o lote', () => {
    const batch = TicketBatch.create(crypto.randomUUID(), batchInput(), NOW);

    expect(() =>
      batch.update({ salesEndDate: batch.salesStartDate }, LATER),
    ).toThrow(InvalidEventScheduleError);
    expect(batch.updatedAt).toEqual(NOW);
  });
});
