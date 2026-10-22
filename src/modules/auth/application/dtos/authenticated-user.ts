import type { UserRole } from '../../../users/domain/value-objects/user-role.js';

/** Identidade extraída de um access token válido de sessão ativa. */
export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  role: UserRole;
}
