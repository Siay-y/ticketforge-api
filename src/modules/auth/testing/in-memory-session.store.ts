import type {
  RotateSessionInput,
  RotationResult,
  Session,
  SessionStore,
} from '../application/ports/session-store.js';

/** Mesma semântica do RedisSessionStore, sem TTL. */
export class InMemorySessionStore implements SessionStore {
  readonly sessions = new Map<string, Session>();

  create(session: Session): Promise<void> {
    this.sessions.set(session.sessionId, { ...session });

    return Promise.resolve();
  }

  rotate(input: RotateSessionInput): Promise<RotationResult> {
    const session = this.sessions.get(input.sessionId);

    if (!session) {
      return Promise.resolve('not_found');
    }

    if (session.tokenId !== input.expectedTokenId) {
      this.sessions.delete(input.sessionId);

      return Promise.resolve('reused');
    }

    session.tokenId = input.nextTokenId;

    return Promise.resolve('rotated');
  }

  isActive(sessionId: string): Promise<boolean> {
    return Promise.resolve(this.sessions.has(sessionId));
  }

  revoke(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);

    return Promise.resolve();
  }
}
