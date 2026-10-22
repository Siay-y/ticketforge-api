import { ApiProperty } from '@nestjs/swagger';
import type { AuthTokens } from '../../../application/dtos/auth-tokens.js';

export class AuthTokensResponse {
  @ApiProperty({ description: 'JWT para o cabeçalho Authorization: Bearer.' })
  accessToken: string;

  @ApiProperty({
    description:
      'Uso único: cada chamada a /auth/refresh devolve um novo e invalida este.',
  })
  refreshToken: string;

  @ApiProperty({ enum: ['Bearer'], example: 'Bearer' })
  tokenType: 'Bearer';

  @ApiProperty({
    description: 'Validade do access token, em segundos.',
    example: 900,
  })
  expiresIn: number;

  static from(tokens: AuthTokens): AuthTokensResponse {
    return Object.assign(new AuthTokensResponse(), tokens);
  }
}
