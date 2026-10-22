import type { User } from '../../domain/entities/user.js';
import type { UserRole } from '../../domain/value-objects/user-role.js';

/** Leitura de usuário exposta para fora do módulo, sem o hash da senha. */
export interface UserView {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export const toUserView = (user: User): UserView => ({
  id: user.id,
  email: user.email.value,
  role: user.role,
  createdAt: user.createdAt,
});
