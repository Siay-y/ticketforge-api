import { UserRole } from '../../../users/domain/value-objects/user-role.js';
import { EventCapacityExceededError } from '../../domain/errors/event-capacity-exceeded.error.js';
import { EventNotFoundError } from '../../domain/errors/event-not-found.error.js';
import { EventStatus } from '../../domain/value-objects/event-status.js';
import { batchInput, eventInput } from '../../testing/event.fixtures.js';
import { InMemoryEventRepository } from '../../testing/in-memory-event.repository.js';
import { EventAccessDeniedError } from '../errors/event-access-denied.error.js';
import type { Actor } from '../policies/event-access.policy.js';
import { AddTicketBatchUseCase } from './add-ticket-batch.use-case.js';
import { CreateEventUseCase } from './create-event.use-case.js';
import { DeleteEventUseCase } from './delete-event.use-case.js';
import { PublishEventUseCase } from './publish-event.use-case.js';
import { UpdateEventUseCase } from './update-event.use-case.js';
import { UpdateTicketBatchUseCase } from './update-ticket-batch.use-case.js';

const actor = (role: UserRole): Actor => ({
  userId: crypto.randomUUID(),
  role,
});

// Datas relativas ao relógio real: os casos de uso usam `new Date()`.
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);

const command = (overrides = {}) => {
  const { organizerId: _ignored, ...input } = eventInput({
    eventDate: inDays(60),
    ...overrides,
  });

  return input;
};

const batch = (overrides = {}) =>
  batchInput({
    salesStartDate: inDays(1),
    salesEndDate: inDays(30),
    ...overrides,
  });

describe('Gestão de eventos (casos de uso)', () => {
  let events: InMemoryEventRepository;
  let owner: Actor;

  beforeEach(() => {
    events = new InMemoryEventRepository();
    owner = actor(UserRole.ORGANIZER);
  });

  const createAs = (who: Actor, overrides = {}) =>
    new CreateEventUseCase(events).execute(who, command(overrides));

  describe('criação', () => {
    it('organizador cria evento e vira o dono', async () => {
      const view = await createAs(owner);

      expect(view.organizerId).toBe(owner.userId);
      expect(view.status).toBe(EventStatus.DRAFT);
    });

    it('admin também cria', async () => {
      await expect(createAs(actor(UserRole.ADMIN))).resolves.toBeDefined();
    });

    it('cliente não cria, mesmo se a rota deixar passar', async () => {
      await expect(createAs(actor(UserRole.CUSTOMER))).rejects.toThrow(
        EventAccessDeniedError,
      );
    });

    it('lotes iniciais acima da capacidade impedem a criação do evento', async () => {
      await expect(
        createAs(owner, {
          maxCapacity: 100,
          initialBatches: [
            batch({ totalQuantity: 60 }),
            batch({ totalQuantity: 41 }),
          ],
        }),
      ).rejects.toThrow(EventCapacityExceededError);
    });
  });

  describe('ownership', () => {
    it('outro organizador não altera, publica nem adiciona lote', async () => {
      const { id } = await createAs(owner, { initialBatches: [batch()] });
      const intruder = actor(UserRole.ORGANIZER);

      await expect(
        new UpdateEventUseCase(events).execute(intruder, id, {
          title: 'Invadido',
        }),
      ).rejects.toThrow(EventAccessDeniedError);
      await expect(
        new PublishEventUseCase(events).execute(intruder, id),
      ).rejects.toThrow(EventAccessDeniedError);
      await expect(
        new AddTicketBatchUseCase(events).execute(intruder, id, batch()),
      ).rejects.toThrow(EventAccessDeniedError);
      expect(events.get(id)?.title).toBe('Festival de Verão 2027');
    });

    it('admin gerencia evento de qualquer organizador', async () => {
      const { id } = await createAs(owner);

      const view = await new UpdateEventUseCase(events).execute(
        actor(UserRole.ADMIN),
        id,
        { title: 'Ajustado pelo admin' },
      );

      expect(view.title).toBe('Ajustado pelo admin');
    });

    it('dono gerencia o próprio evento', async () => {
      const { id } = await createAs(owner);

      const added = await new AddTicketBatchUseCase(events).execute(
        owner,
        id,
        batch({ totalQuantity: 10 }),
      );

      expect(added.availableQuantity).toBe(10);
    });
  });

  describe('atomicidade', () => {
    it('regra violada no meio da alteração não grava nada', async () => {
      const { id, batches } = await createAs(owner, {
        maxCapacity: 100,
        initialBatches: [batch({ totalQuantity: 100 })],
      });

      await expect(
        new UpdateTicketBatchUseCase(events).execute(owner, id, batches[0].id, {
          name: 'Renomeado',
          totalQuantity: 101,
        }),
      ).rejects.toThrow(EventCapacityExceededError);
      expect(events.get(id)?.batches[0].name).toBe('1º Lote');
    });
  });

  it('evento removido some para a gestão', async () => {
    const { id } = await createAs(owner);

    await new DeleteEventUseCase(events).execute(owner, id);

    await expect(
      new UpdateEventUseCase(events).execute(owner, id, { title: 'Volta' }),
    ).rejects.toThrow(EventNotFoundError);
  });
});
