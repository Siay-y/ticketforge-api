/** Categoria semântica do erro. A tradução para status HTTP é feita na apresentação. */
export type DomainErrorKind =
  'validation' | 'conflict' | 'not_found' | 'unauthorized' | 'forbidden';

export abstract class DomainError extends Error {
  abstract readonly kind: DomainErrorKind;
  /** Código estável para o cliente, independente do texto da mensagem. */
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
