import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class RefreshTokenRequest {
  @ApiProperty({
    description: 'Refresh token recebido no login ou na última rotação.',
  })
  @IsJWT({ message: 'refreshToken deve ser um JWT' })
  refreshToken: string;
}
