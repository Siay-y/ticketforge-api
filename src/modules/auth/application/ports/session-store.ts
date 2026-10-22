export interface Session {
  sessionId: string;
  userId: string;
  /** jti do único refresh token aceito para esta sessão. */
  tokenId: string;
}

export interface RotateSessionInput {
  sessionId: string;
  expectedTokenId: string;
  nextTokenId: string;
}

/**
 * - `rotated`: o token apresentado era o ativo e foi substituído.
 * - `reused`: o token já tinha sido trocado; a sessão foi revogada.
 * - `not_found`: sessão expirada ou revogada.
 */
export type RotationResult = 'rotated' | 'reused' | 'not_found';

export abstract class SessionStore {
  abstract create(session: Session, ttlSeconds: number): Promise<void>;

  /** Compara e troca o token ativo atomicamente, renovando o TTL da sessão. */
  abstract rotate(
    input: RotateSessionInput,
    ttlSeconds: number,
  ): Promise<RotationResult>;

  abstract isActive(sessionId: string): Promise<boolean>;

  abstract revoke(sessionId: string): Promise<void>;
}
