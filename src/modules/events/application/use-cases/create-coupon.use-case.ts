import { Injectable } from '@nestjs/common';
import {
  Coupon,
  type CreateCouponInput,
} from '../../domain/entities/coupon.js';
import { EventNotFoundError } from '../../domain/errors/event-not-found.error.js';
import { CouponRepository } from '../../domain/repositories/coupon.repository.js';
import { EventRepository } from '../../domain/repositories/event.repository.js';
import { type CouponView, toCouponView } from '../dtos/coupon.view.js';
import {
  type Actor,
  assertCanManage,
} from '../policies/event-access.policy.js';

export type CreateCouponCommand = Omit<CreateCouponInput, 'eventId'>;

@Injectable()
export class CreateCouponUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly coupons: CouponRepository,
  ) {}

  async execute(
    actor: Actor,
    eventId: string,
    command: CreateCouponCommand,
  ): Promise<CouponView> {
    const event = await this.events.findById(eventId);

    if (!event) {
      throw new EventNotFoundError();
    }

    assertCanManage(event, actor);
    event.assertEditable();

    const coupon = Coupon.create({ ...command, eventId }, new Date());

    await this.coupons.create(coupon);

    return toCouponView(coupon);
  }
}
