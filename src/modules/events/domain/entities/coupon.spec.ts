import { CouponNotRedeemableError } from '../errors/coupon-not-redeemable.error.js';
import { InvalidEventDataError } from '../errors/invalid-event-data.error.js';
import { InvalidEventScheduleError } from '../errors/invalid-event-schedule.error.js';
import { DiscountType } from '../value-objects/discount-type.js';
import { Coupon, type CreateCouponInput } from './coupon.js';

const NOW = new Date('2027-01-01T12:00:00.000Z');
const LATER = new Date('2027-02-01T12:00:00.000Z');

const input = (
  overrides: Partial<CreateCouponInput> = {},
): CreateCouponInput => ({
  eventId: crypto.randomUUID(),
  code: 'verao15',
  discountType: DiscountType.PERCENTAGE,
  discountValue: 1500,
  maxUses: null,
  expiresAt: LATER,
  ...overrides,
});

const rejectionOf = (run: () => void): string | undefined => {
  try {
    run();
  } catch (error) {
    return (error as CouponNotRedeemableError).code;
  }

  return undefined;
};

describe('Coupon', () => {
  it('grava o código em maiúsculas e nasce ativo e sem usos', () => {
    const coupon = Coupon.create(input({ code: '  verao15 ' }), NOW);

    expect(coupon).toMatchObject({
      code: 'VERAO15',
      usedCount: 0,
      isActive: true,
    });
  });

  it.each([
    ['código curto', { code: 'AB' }],
    ['código com espaço', { code: 'VER AO' }],
    ['percentual acima de 100%', { discountValue: 10_001 }],
    ['valor zero', { discountValue: 0 }],
    ['limite de usos zero', { maxUses: 0 }],
  ])('recusa %s', (_, overrides) => {
    expect(() => Coupon.create(input(overrides), NOW)).toThrow(
      InvalidEventDataError,
    );
  });

  it('recusa validade no passado', () => {
    expect(() => Coupon.create(input({ expiresAt: NOW }), NOW)).toThrow(
      InvalidEventScheduleError,
    );
  });

  describe('cálculo do desconto', () => {
    it('percentual em pontos-base, arredondando para baixo', () => {
      const coupon = Coupon.create(input({ discountValue: 1500 }), NOW);

      expect(coupon.discountFor(25_000)).toBe(3_750);
      // 15% de 999 = 149,85 centavos: o cliente nunca ganha além do anunciado.
      expect(coupon.discountFor(999)).toBe(149);
    });

    it('100% zera o total sem passar dele', () => {
      const coupon = Coupon.create(input({ discountValue: 10_000 }), NOW);

      expect(coupon.discountFor(12_345)).toBe(12_345);
    });

    it('valor fixo nunca passa do subtotal: o total não fica negativo', () => {
      const coupon = Coupon.create(
        input({ discountType: DiscountType.FIXED_CENTS, discountValue: 5_000 }),
        NOW,
      );

      expect(coupon.discountFor(20_000)).toBe(5_000);
      expect(coupon.discountFor(3_000)).toBe(3_000);
    });
  });

  describe('resgate', () => {
    it('consome usos até o limite e depois recusa como esgotado', () => {
      const coupon = Coupon.create(input({ maxUses: 2 }), NOW);

      coupon.redeem(NOW);
      coupon.redeem(NOW);

      expect(coupon.usedCount).toBe(2);
      expect(rejectionOf(() => coupon.redeem(NOW))).toBe('COUPON_EXHAUSTED');
    });

    it('sem limite, aceita quantos usos vierem', () => {
      const coupon = Coupon.create(input({ maxUses: null }), NOW);

      for (let use = 0; use < 50; use++) {
        coupon.redeem(NOW);
      }

      expect(coupon.usedCount).toBe(50);
    });

    it('recusa cupom expirado e cupom desativado', () => {
      const expired = Coupon.create(input(), NOW);
      const inactive = Coupon.restore({
        ...propsOf(Coupon.create(input(), NOW)),
        isActive: false,
      });

      expect(rejectionOf(() => expired.redeem(LATER))).toBe('COUPON_EXPIRED');
      expect(rejectionOf(() => inactive.redeem(NOW))).toBe('COUPON_INACTIVE');
    });

    it('devolver o uso libera uma vaga e nunca deixa a contagem negativa', () => {
      const coupon = Coupon.create(input({ maxUses: 1 }), NOW);

      coupon.redeem(NOW);
      coupon.releaseUse(NOW);
      coupon.releaseUse(NOW);

      expect(coupon.usedCount).toBe(0);
      expect(() => coupon.redeem(NOW)).not.toThrow();
    });
  });
});

function propsOf(coupon: Coupon) {
  return {
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
  };
}
