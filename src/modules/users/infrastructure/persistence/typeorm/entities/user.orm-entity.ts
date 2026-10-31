import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { UserRole } from '../../../../domain/value-objects/user-role.js';

export const USERS_EMAIL_UNIQUE_INDEX = 'UQ_users_email';

@Entity({ name: 'users' })
// O índice único só impede duplicatas se o e-mail chegar normalizado.
@Check('CHK_users_email_lowercase', '"email" = lower("email")')
export class UserOrmEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'PK_users' })
  id: string;

  @Index(USERS_EMAIL_UNIQUE_INDEX, { unique: true })
  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role',
    default: UserRole.CUSTOMER,
  })
  role: UserRole;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamptz', default: () => 'now()' })
  updatedAt: Date;
}
