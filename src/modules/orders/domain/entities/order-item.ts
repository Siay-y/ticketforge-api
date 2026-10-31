export interface OrderItemProps {
  id: string;
  batchId: string;
  quantity: number;
  /** Snapshot do preço na compra. */
  unitPriceCents: number;
  totalPriceCents: number;
}

export interface OrderLine {
  batchId: string;
  quantity: number;
  unitPriceCents: number;
}

export class OrderItem {
  private constructor(private readonly props: OrderItemProps) {
    if (!Number.isSafeInteger(props.quantity) || props.quantity < 1) {
      throw new Error('A quantidade do item deve ser um inteiro positivo');
    }

    if (props.totalPriceCents !== props.quantity * props.unitPriceCents) {
      throw new Error('O total do item não confere com quantidade e preço');
    }
  }

  static create(line: OrderLine): OrderItem {
    return new OrderItem({
      id: crypto.randomUUID(),
      ...line,
      totalPriceCents: line.quantity * line.unitPriceCents,
    });
  }

  static restore(props: OrderItemProps): OrderItem {
    return new OrderItem({ ...props });
  }

  get id(): string {
    return this.props.id;
  }

  get batchId(): string {
    return this.props.batchId;
  }

  get quantity(): number {
    return this.props.quantity;
  }

  get unitPriceCents(): number {
    return this.props.unitPriceCents;
  }

  get totalPriceCents(): number {
    return this.props.totalPriceCents;
  }
}
