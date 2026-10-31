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

/** `reused`: token já trocado, sessão revogada. `not_found`: expirada ou revogada. */
export type RotationResult = 'rotated' | 'reused' | 'not_found';

export abstract class SessionStore {
  abstract create(session: Session, ttlSeconds: number): Promise<void>;

  /** Deve ser atômico: compara, troca o token ativo e renova o TTL. */
  abstract rotate(
    input: RotateSessionInput,
    ttlSeconds: number,
  ): Promise<RotationResult>;

  abstract isActive(sessionId: string): Promise<boolean>;

  abstract revoke(sessionId: string): Promise<void>;
}
