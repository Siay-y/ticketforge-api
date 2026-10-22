import { Injectable } from '@nestjs/common';
import { UserNotFoundError } from '../../domain/errors/user-not-found.error.js';
import { UserRepository } from '../../domain/repositories/user.repository.js';
import { type UserView, toUserView } from '../dtos/user.view.js';

@Injectable()
export class GetUserProfileUseCase {
  constructor(private readonly users: UserRepository) {}

  async execute(userId: string): Promise<UserView> {
    const user = await this.users.findById(userId);

    if (!user) {
      throw new UserNotFoundError();
    }

    return toUserView(user);
  }
}
