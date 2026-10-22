import { ApiProperty } from '@nestjs/swagger';
import type { UserView } from '../../../application/dtos/user.view.js';
import { UserRole } from '../../../domain/value-objects/user-role.js';

export class UserResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'cliente@ticketforge.dev' })
  email: string;

  @ApiProperty({ enum: UserRole, enumName: 'UserRole' })
  role: UserRole;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  static from(view: UserView): UserResponse {
    return Object.assign(new UserResponse(), view);
  }
}
