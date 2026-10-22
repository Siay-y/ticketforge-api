export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Validade do access token, em segundos. */
  expiresIn: number;
}
