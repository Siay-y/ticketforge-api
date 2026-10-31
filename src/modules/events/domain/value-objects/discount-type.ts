export enum DiscountType {
  /** `discountValue` em pontos-base: 10000 = 100%, 1500 = 15%, 1 = 0,01%. */
  PERCENTAGE = 'percentage',
  /** `discountValue` em centavos: 5000 = R$ 50,00. */
  FIXED_CENTS = 'fixed_cents',
}

export const PERCENTAGE_BASE = 10_000;
