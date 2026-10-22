import { User } from '../../../../domain/entities/user.js';
import { Email } from '../../../../domain/value-objects/email.js';
import { UserOrmEntity } from '../entities/user.orm-entity.js';

export const UserMapper = {
  toDomain(row: UserOrmEntity): User {
    return User.restore({
      id: row.id,
      email: Email.create(row.email),
      passwordHash: row.passwordHash,
      role: row.role,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  },

  toPersistence(user: User): UserOrmEntity {
    const row = new UserOrmEntity();

    row.id = user.id;
    row.email = user.email.value;
    row.passwordHash = user.passwordHash;
    row.role = user.role;
    row.createdAt = user.createdAt;
    row.updatedAt = user.updatedAt;

    return row;
  },
};
