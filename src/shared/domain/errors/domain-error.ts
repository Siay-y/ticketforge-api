/** `validation`: dado malformado (400). `business_rule`: dado válido que viola regra (422). */
export type DomainErrorKind =
  | 'validation'
  | 'business_rule'
  | 'conflict'
  | 'not_found'
  | 'unauthorized'
  | 'forbidden';

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;
  /** Estável para o cliente, ao contrário da mensagem. */
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
