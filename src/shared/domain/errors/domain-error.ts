/**
 * Categoria semântica do erro. A tradução para status HTTP é feita na apresentação.
 * `validation` é dado malformado; `business_rule` é dado bem formado que viola uma regra.
 */
export type DomainErrorKind =
  | 'validation'
  | 'business_rule'
  | 'conflict'
  | 'not_found'
  | 'unauthorized'
  | 'forbidden';

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;
  /** Código estável para o cliente, independente do texto da mensagem. */
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
