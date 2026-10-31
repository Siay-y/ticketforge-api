import { Injectable } from '@nestjs/common';
import { EventNotFoundError } from '../../domain/errors/event-not-found.error.js';
import { CouponRepository } from '../../domain/repositories/coupon.repository.js';
import { EventRepository } from '../../domain/repositories/event.repository.js';
import { type CouponView, toCouponView } from '../dtos/coupon.view.js';
import {
  type Actor,
  assertCanManage,
} from '../policies/event-access.policy.js';

@Injectable()
export class ListCouponsUseCase {
  constructor(
    private readonly events: EventRepository,
    private readonly coupons: CouponRepository,
  ) {}

  async execute(actor: Actor, eventId: string): Promise<CouponView[]> {
    const event = await this.events.findById(eventId);

    if (!event) {
      throw new EventNotFoundError();
    }

    assertCanManage(event, actor);

    return (await this.coupons.listByEvent(eventId)).map(toCouponView);
  }
}
