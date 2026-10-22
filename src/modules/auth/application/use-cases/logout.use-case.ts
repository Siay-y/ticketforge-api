import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../dtos/authenticated-user.js';
import { SessionStore } from '../ports/session-store.js';

@Injectable()
export class LogoutUseCase {
  constructor(private readonly sessions: SessionStore) {}

  /** Revoga a sessão inteira: access e refresh tokens dela deixam de valer na hora. */
  async execute(user: AuthenticatedUser): Promise<void> {
    await this.sessions.revoke(user.sessionId);
  }
}
