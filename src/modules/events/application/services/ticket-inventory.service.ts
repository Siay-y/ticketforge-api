import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../../shared/application/unit-of-work.js';
import { Coupon } from '../../domain/entities/coupon.js';
import type { TicketBatch } from '../../domain/entities/ticket-batch.js';
import { BatchEventMismatchError } from '../../domain/errors/batch-event-mismatch.error.js';
import { CouponNotRedeemableError } from '../../domain/errors/coupon-not-redeemable.error.js';
import { EventNotFoundError } from '../../domain/errors/event-not-found.error.js';
import { EventNotOnSaleError } from '../../domain/errors/event-not-on-sale.error.js';
import { TicketBatchNotFoundError } from '../../domain/errors/ticket-batch-not-found.error.js';
import { CouponRepository } from '../../domain/repositories/coupon.repository.js';
import { TicketStockRepository } from '../../domain/repositories/ticket-stock.repository.js';
import { EventStatus } from '../../domain/value-objects/event-status.js';

export interface StockLine {
  batchId: string;
  quantity: number;
}

export interface PricedLine extends StockLine {
  unitPriceCents: number;
}

export interface ReserveInput {
  eventId: string;
  lines: StockLine[];
  couponCode?: string;
}

export interface Reservation {
  lines: PricedLine[];
  couponId: string | null;
  discountCents: number;
}

export interface ReleaseInput {
  lines: StockLine[];
  couponId: string | null;
}

/** API pública de events para vendas; roda na transação de quem chama. */
@Injectable()
export class TicketInventoryService {
  constructor(
    private readonly unitOfWork: UnitOfWork,
    private readonly stock: TicketStockRepository,
    private readonly coupons: CouponRepository,
  ) {}

  reserve(input: ReserveInput, now: Date): Promise<Reservation> {
    return this.unitOfWork.run(async () => {
      const batches = await this.lockBatches(input.lines);

      if (batches.some((batch) => batch.eventId !== input.eventId)) {
        throw new BatchEventMismatchError();
      }

      // Lido após os locks: alterar o evento trava os mesmos lotes.
      const event = await this.stock.findEventSaleStatus(input.eventId);

      if (!event) {
        throw new EventNotFoundError();
      }

      if (event.status !== EventStatus.PUBLISHED || event.eventDate <= now) {
        throw new EventNotOnSaleError();
      }

      const byId = new Map(batches.map((batch) => [batch.id, batch]));
      const lines = input.lines.map((line): PricedLine => {
        const batch = byId.get(line.batchId) as TicketBatch;

        batch.reserve(line.quantity, now);

        return { ...line, unitPriceCents: batch.unitPriceCents };
      });

      const coupon = input.couponCode
        ? await this.redeemCoupon(input.eventId, input.couponCode, now)
        : null;
      const subtotalCents = lines.reduce(
        (sum, line) => sum + line.unitPriceCents * line.quantity,
        0,
      );

      await this.stock.saveStock(batches);

      if (coupon) {
        await this.coupons.saveUsage(coupon);
      }

      return {
        lines,
        couponId: coupon?.id ?? null,
        discountCents: coupon?.discountFor(subtotalCents) ?? 0,
      };
    });
  }

  /** Mesma ordem de locks da reserva: lotes, depois cupom. */
  release(input: ReleaseInput, now: Date): Promise<void> {
    return this.unitOfWork.run(async () => {
      const batches = await this.lockBatches(input.lines);
      const byId = new Map(batches.map((batch) => [batch.id, batch]));

      for (const line of input.lines) {
        (byId.get(line.batchId) as TicketBatch).release(line.quantity, now);
      }

      await this.stock.saveStock(batches);

      if (input.couponId) {
        const coupon = await this.coupons.lockById(input.couponId);

        if (coupon) {
          coupon.releaseUse(now);
          await this.coupons.saveUsage(coupon);
        }
      }
    });
  }

  private async lockBatches(lines: StockLine[]): Promise<TicketBatch[]> {
    const ids = [...new Set(lines.map((line) => line.batchId))];
    const batches = await this.stock.lockBatches(ids);

    if (batches.length !== ids.length) {
      throw new TicketBatchNotFoundError();
    }

    return batches;
  }

  private async redeemCoupon(
    eventId: string,
    code: string,
    now: Date,
  ): Promise<Coupon> {
    const coupon = await this.coupons.lockByCode(
      eventId,
      Coupon.normalizeCode(code),
    );

    if (!coupon) {
      throw new CouponNotRedeemableError('not_found');
    }

    coupon.redeem(now);

    return coupon;
  }
}
