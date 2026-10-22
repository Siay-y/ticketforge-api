import { InvalidEventDataError } from '../errors/invalid-event-data.error.js';
import { InvalidEventScheduleError } from '../errors/invalid-event-schedule.error.js';
import { TicketBatchQuantityBelowSoldError } from '../errors/ticket-batch-quantity-below-sold.error.js';

// R$ 1.000.000,00: folga ampla para ingressos e bem abaixo do teto de `integer` no banco.
export const MAX_UNIT_PRICE_CENTS = 100_000_000;
export const MAX_BATCH_NAME_LENGTH = 100;

export interface TicketBatchProps {
  id: string;
  eventId: string;
  name: string;
  /** Preço em centavos: inteiro exato, sem erro de ponto flutuante. */
  unitPriceCents: number;
  totalQuantity: number;
  availableQuantity: number;
  salesStartDate: Date;
  salesEndDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketBatchInput {
  name: string;
  unitPriceCents: number;
  totalQuantity: number;
  salesStartDate: Date;
  salesEndDate: Date;
}

export type TicketBatchChanges = Partial<TicketBatchInput>;

export class TicketBatch {
  private constructor(private props: TicketBatchProps) {
    TicketBatch.validate(props);
  }

  static create(
    eventId: string,
    input: TicketBatchInput,
    now: Date,
  ): TicketBatch {
    return new TicketBatch({
      id: crypto.randomUUID(),
      eventId,
      name: input.name.trim(),
      unitPriceCents: input.unitPriceCents,
      totalQuantity: input.totalQuantity,
      availableQuantity: input.totalQuantity,
      salesStartDate: input.salesStartDate,
      salesEndDate: input.salesEndDate,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: TicketBatchProps): TicketBatch {
    return new TicketBatch({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get eventId(): string {
    return this.props.eventId;
  }

  get name(): string {
    return this.props.name;
  }

  get unitPriceCents(): number {
    return this.props.unitPriceCents;
  }

  get totalQuantity(): number {
    return this.props.totalQuantity;
  }

  get availableQuantity(): number {
    return this.props.availableQuantity;
  }

  get soldQuantity(): number {
    return this.props.totalQuantity - this.props.availableQuantity;
  }

  get salesStartDate(): Date {
    return this.props.salesStartDate;
  }

  get salesEndDate(): Date {
    return this.props.salesEndDate;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** O que já foi vendido é preservado: só a parte disponível acompanha a nova quantidade. */
  update(changes: TicketBatchChanges, now: Date): void {
    const totalQuantity = changes.totalQuantity ?? this.props.totalQuantity;
    const sold = this.soldQuantity;

    if (totalQuantity < sold) {
      throw new TicketBatchQuantityBelowSoldError(sold);
    }

    const next: TicketBatchProps = {
      ...this.props,
      name: changes.name?.trim() ?? this.props.name,
      unitPriceCents: changes.unitPriceCents ?? this.props.unitPriceCents,
      totalQuantity,
      availableQuantity: totalQuantity - sold,
      salesStartDate: changes.salesStartDate ?? this.props.salesStartDate,
      salesEndDate: changes.salesEndDate ?? this.props.salesEndDate,
      updatedAt: now,
    };

    TicketBatch.validate(next);
    this.props = next;
  }

  private static validate(props: TicketBatchProps): void {
    if (!props.name || props.name.length > MAX_BATCH_NAME_LENGTH) {
      throw new InvalidEventDataError(
        `O nome do lote deve ter de 1 a ${MAX_BATCH_NAME_LENGTH} caracteres`,
      );
    }

    if (
      !Number.isSafeInteger(props.unitPriceCents) ||
      props.unitPriceCents < 0 ||
      props.unitPriceCents > MAX_UNIT_PRICE_CENTS
    ) {
      throw new InvalidEventDataError(
        'O preço deve ser um inteiro em centavos, entre 0 e 100000000',
      );
    }

    if (!Number.isSafeInteger(props.totalQuantity) || props.totalQuantity < 1) {
      throw new InvalidEventDataError(
        'A quantidade total do lote deve ser um inteiro positivo',
      );
    }

    if (
      !Number.isSafeInteger(props.availableQuantity) ||
      props.availableQuantity < 0 ||
      props.availableQuantity > props.totalQuantity
    ) {
      throw new InvalidEventDataError(
        'A quantidade disponível deve ficar entre 0 e a quantidade total',
      );
    }

    if (props.salesStartDate >= props.salesEndDate) {
      throw new InvalidEventScheduleError(
        'O início das vendas deve ser anterior ao fim das vendas',
      );
    }
  }
}
