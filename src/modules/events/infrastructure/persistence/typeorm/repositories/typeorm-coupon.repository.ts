import { Injectable } from '@nestjs/common';
import { isUniqueViolation } from '../../../../../../shared/infrastructure/persistence/typeorm/postgres-errors.js';
import { TransactionContext } from '../../../../../../shared/infrastructure/persistence/typeorm/typeorm-unit-of-work.js';
import { Coupon } from '../../../../domain/entities/coupon.js';
import { CouponCodeAlreadyExistsError } from '../../../../domain/errors/coupon-code-already-exists.error.js';
import type { CouponRepository } from '../../../../domain/repositories/coupon.repository.js';
import {
  COUPONS_EVENT_CODE_UNIQUE_INDEX,
  CouponOrmEntity,
} from '../entities/coupon.orm-entity.js';

@Injectable()
export class TypeOrmCouponRepository implements CouponRepository {
  constructor(private readonly transaction: TransactionContext) {}

  async create(coupon: Coupon): Promise<void> {
    try {
      await this.transaction.manager.insert(CouponOrmEntity, toRow(coupon));
    } catch (error) {
      if (isUniqueViolation(error, COUPONS_EVENT_CODE_UNIQUE_INDEX)) {
        throw new CouponCodeAlreadyExistsError();
      }

      throw error;
    }
  }

  async listByEvent(eventId: string): Promise<Coupon[]> {
    const rows = await this.transaction.manager.find(CouponOrmEntity, {
      where: { eventId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });

    return rows.map(toDomain);
  }

  lockByCode(eventId: string, code: string): Promise<Coupon | null> {
    return this.lockOne({ eventId, code });
  }

  lockById(couponId: string): Promise<Coupon | null> {
    return this.lockOne({ id: couponId });
  }

  async saveUsage(coupon: Coupon): Promise<void> {
    await this.transaction.manager.update(
      CouponOrmEntity,
      { id: coupon.id },
      { usedCount: coupon.usedCount, updatedAt: coupon.updatedAt },
    );
  }

  private async lockOne(
    where: Partial<Pick<CouponOrmEntity, 'id' | 'eventId' | 'code'>>,
  ): Promise<Coupon | null> {
    const row = await this.transaction.transactionalManager.findOne(
      CouponOrmEntity,
      { where, lock: { mode: 'pessimistic_write' } },
    );

    return row ? toDomain(row) : null;
  }
}

const toDomain = (row: CouponOrmEntity): Coupon =>
  Coupon.restore({
    id: row.id,
    eventId: row.eventId,
    code: row.code,
    discountType: row.discountType,
    discountValue: row.discountValue,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    expiresAt: row.expiresAt,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });

const toRow = (coupon: Coupon): Omit<CouponOrmEntity, 'event'> => ({
  id: coupon.id,
  eventId: coupon.eventId,
  code: coupon.code,
  discountType: coupon.discountType,
  discountValue: coupon.discountValue,
  maxUses: coupon.maxUses,
  usedCount: coupon.usedCount,
  expiresAt: coupon.expiresAt,
  isActive: coupon.isActive,
  createdAt: coupon.createdAt,
  updatedAt: coupon.updatedAt,
});
