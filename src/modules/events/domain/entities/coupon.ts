import { CouponNotRedeemableError } from '../errors/coupon-not-redeemable.error.js';
import { InvalidEventDataError } from '../errors/invalid-event-data.error.js';
import { InvalidEventScheduleError } from '../errors/invalid-event-schedule.error.js';
import {
  DiscountType,
  PERCENTAGE_BASE,
} from '../value-objects/discount-type.js';
import { MAX_UNIT_PRICE_CENTS } from './ticket-batch.js';

export const COUPON_CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;
export const MAX_COUPON_USES = 1_000_000;

export interface CouponProps {
  id: string;
  eventId: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  /** `null` = usos ilimitados. */
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCouponInput {
  eventId: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxUses: number | null;
  expiresAt: Date;
}

export class Coupon {
  private constructor(private props: CouponProps) {
    Coupon.validate(props);
  }

  static create(input: CreateCouponInput, now: Date): Coupon {
    if (input.expiresAt <= now) {
      throw new InvalidEventScheduleError(
        'A validade do cupom deve estar no futuro',
      );
    }

    return new Coupon({
      ...input,
      id: crypto.randomUUID(),
      code: Coupon.normalizeCode(input.code),
      usedCount: 0,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(props: CouponProps): Coupon {
    return new Coupon({ ...props });
  }

  static normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  get id(): string {
    return this.props.id;
  }

  get eventId(): string {
    return this.props.eventId;
  }

  get code(): string {
    return this.props.code;
  }

  get discountType(): DiscountType {
    return this.props.discountType;
  }

  get discountValue(): number {
    return this.props.discountValue;
  }

  get maxUses(): number | null {
    return this.props.maxUses;
  }

  get usedCount(): number {
    return this.props.usedCount;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  /** Chamar com o cupom travado, dentro da transação. */
  redeem(now: Date): void {
    if (!this.props.isActive) {
      throw new CouponNotRedeemableError('inactive');
    }

    if (now >= this.props.expiresAt) {
      throw new CouponNotRedeemableError('expired');
    }

    if (
      this.props.maxUses !== null &&
      this.props.usedCount >= this.props.maxUses
    ) {
      throw new CouponNotRedeemableError('exhausted');
    }

    this.props = {
      ...this.props,
      usedCount: this.props.usedCount + 1,
      updatedAt: now,
    };
  }

  /** Vale mesmo para cupom expirado ou inativo. */
  releaseUse(now: Date): void {
    if (this.props.usedCount === 0) {
      return;
    }

    this.props = {
      ...this.props,
      usedCount: this.props.usedCount - 1,
      updatedAt: now,
    };
  }

  /** Nunca maior que o subtotal; percentual arredonda para baixo. */
  discountFor(subtotalCents: number): number {
    const discount =
      this.props.discountType === DiscountType.PERCENTAGE
        ? Math.floor(
            (subtotalCents * this.props.discountValue) / PERCENTAGE_BASE,
          )
        : this.props.discountValue;

    return Math.min(discount, subtotalCents);
  }

  private static validate(props: CouponProps): void {
    if (!COUPON_CODE_PATTERN.test(props.code)) {
      throw new InvalidEventDataError(
        'O código do cupom deve ter de 3 a 32 caracteres: letras, números, hífen ou sublinhado',
      );
    }

    const maxValue =
      props.discountType === DiscountType.PERCENTAGE
        ? PERCENTAGE_BASE
        : MAX_UNIT_PRICE_CENTS;

    if (
      !Number.isSafeInteger(props.discountValue) ||
      props.discountValue < 1 ||
      props.discountValue > maxValue
    ) {
      throw new InvalidEventDataError(
        `O valor do desconto deve ser um inteiro entre 1 e ${maxValue}`,
      );
    }

    if (
      props.maxUses !== null &&
      (!Number.isSafeInteger(props.maxUses) ||
        props.maxUses < 1 ||
        props.maxUses > MAX_COUPON_USES)
    ) {
      throw new InvalidEventDataError(
        `O limite de usos deve ser nulo (ilimitado) ou um inteiro entre 1 e ${MAX_COUPON_USES}`,
      );
    }

    if (
      props.usedCount < 0 ||
      (props.maxUses !== null && props.usedCount > props.maxUses)
    ) {
      throw new InvalidEventDataError(
        'Contagem de usos fora do limite do cupom',
      );
    }
  }
}
