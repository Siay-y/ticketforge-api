import type { UserRole } from '../../../users/domain/value-objects/user-role.js';

export interface AuthenticatedUser {
  userId: string;
  sessionId: string;
  role: UserRole;
}
