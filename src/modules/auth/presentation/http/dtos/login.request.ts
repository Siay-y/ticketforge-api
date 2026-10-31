import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PASSWORD_MAX_LENGTH } from './register.request.js';

export class LoginRequest {
  @ApiProperty({ example: 'cliente@ticketforge.dev', maxLength: 254 })
  @IsEmail({}, { message: 'email deve ser um e-mail válido' })
  @MaxLength(254)
  email: string;

  // Só o teto: o login não revela a política de senha.
  @ApiProperty({
    example: 'Ingresso#2026Seguro',
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}
