import { DomainError } from '../../../../shared/domain/errors/domain-error.js';

export class RefreshTokenReuseError extends DomainError {
  readonly kind = 'unauthorized';
  readonly code = 'REFRESH_TOKEN_REUSED';

  constructor() {
    super('Refresh token reutilizado. A sessão foi encerrada por segurança');
  }
}
