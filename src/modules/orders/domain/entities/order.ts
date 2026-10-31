import { InvalidOrderStatusError } from '../errors/invalid-order-status.error.js';
import { OrderExpiredError } from '../errors/order-expired.error.js';
import { OrderTicketLimitExceededError } from '../errors/order-ticket-limit-exceeded.error.js';
import { OrderStatus } from '../value-objects/order-status.js';
import { type OrderLine, OrderItem } from './order-item.js';

export const MAX_TICKETS_PER_ORDER = 10;
export const ORDER_HOLD_MINUTES = 15;

export interface OrderProps {
  id: string;
  customerId: string;
  eventId: string;
  couponId: string | null;
  status: OrderStatus;
  items: OrderItem[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  idempotencyKey: string;
  /** SHA-256 do corpo: detecta chave reutilizada com outro conteúdo. */
  requestHash: string;
  expiresAt: Date;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaceOrderInput {
  customerId: string;
  eventId: string;
  idempotencyKey: string;
  requestHash: string;
  lines: OrderLine[];
  couponId: string | null;
  discountCents: number;
}

export class Order {
  private constructor(private props: OrderProps) {}

  /** Checado antes de travar qualquer lote. */
  static assertWithinTicketLimit(lines: { quantity: number }[]): void {
    const total = lines.reduce((sum, line) => sum + line.quantity, 0);

    if (total > MAX_TICKETS_PER_ORDER) {
      throw new OrderTicketLimitExceededError(MAX_TICKETS_PER_ORDER);
    }
  }

  static place(input: PlaceOrderInput, now: Date): Order {
    Order.assertWithinTicketLimit(input.lines);

    if (input.lines.length === 0) {
      throw new Error('Um pedido precisa de ao menos um item');
    }

    const items = input.lines.map((line) => OrderItem.create(line));
    const subtotalCents = items.reduce(
      (sum, item) => sum + item.totalPriceCents,
      0,
    );

    if (
      !Number.isSafeInteger(input.discountCents) ||
      input.discountCents < 0 ||
      input.discountCents > subtotalCents
    ) {
      throw new Error('O desconto deve ficar entre zero e o subtotal');
    }

    return new Order({
      id: crypto.randomUUID(),
      customerId: input.customerId,
      eventId: input.eventId,
      couponId: input.couponId,
      status: OrderStatus.PENDING,
      items,
      subtotalCents,
      discountCents: input.discountCents,
      totalCents: subtotalCents - input.discountCents,
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash,
      expiresAt: new Date(now.getTime() + ORDER_HOLD_MINUTES * 60_000),
      paidAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: OrderProps): Order {
    return new Order({ ...props, items: [...props.items] });
  }

  get id(): string {
    return this.props.id;
  }

  get customerId(): string {
    return this.props.customerId;
  }

  get eventId(): string {
    return this.props.eventId;
  }

  get couponId(): string | null {
    return this.props.couponId;
  }

  get status(): OrderStatus {
    return this.props.status;
  }

  get items(): readonly OrderItem[] {
    return this.props.items;
  }

  get subtotalCents(): number {
    return this.props.subtotalCents;
  }

  get discountCents(): number {
    return this.props.discountCents;
  }

  get totalCents(): number {
    return this.props.totalCents;
  }

  get idempotencyKey(): string {
    return this.props.idempotencyKey;
  }

  get requestHash(): string {
    return this.props.requestHash;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get paidAt(): Date | null {
    return this.props.paidAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Vale até `expiresAt`, inclusive. */
  pay(now: Date): void {
    this.assertPending('Só pedidos pendentes podem ser pagos');

    if (now > this.props.expiresAt) {
      throw new OrderExpiredError();
    }

    this.props = {
      ...this.props,
      status: OrderStatus.PAID,
      paidAt: now,
      updatedAt: now,
    };
  }

  /** Pendente vencido também cancela: é o que devolve o estoque. */
  cancel(now: Date): void {
    this.assertPending('Só pedidos pendentes podem ser cancelados');
    this.props = {
      ...this.props,
      status: OrderStatus.CANCELLED,
      updatedAt: now,
    };
  }

  private assertPending(message: string): void {
    if (this.props.status !== OrderStatus.PENDING) {
      throw new InvalidOrderStatusError(message);
    }
  }
}
