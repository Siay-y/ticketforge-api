import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsStrongPassword, MaxLength } from 'class-validator';

export const PASSWORD_MIN_LENGTH = 12;
// Teto contra DoS: cada caractere a mais encarece o hash.
export const PASSWORD_MAX_LENGTH = 128;

export class RegisterRequest {
  @ApiProperty({ example: 'cliente@ticketforge.dev', maxLength: 254 })
  @IsEmail({}, { message: 'email deve ser um e-mail válido' })
  @MaxLength(254)
  email: string;

  @ApiProperty({
    example: 'Ingresso#2026Seguro',
    minLength: PASSWORD_MIN_LENGTH,
    maxLength: PASSWORD_MAX_LENGTH,
    description:
      'Mínimo de 12 caracteres, com letra minúscula, maiúscula, número e símbolo.',
  })
  @IsStrongPassword(
    {
      minLength: PASSWORD_MIN_LENGTH,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    },
    {
      message:
        'password deve ter no mínimo 12 caracteres, com letra minúscula, maiúscula, número e símbolo',
    },
  )
  @MaxLength(PASSWORD_MAX_LENGTH)
  password: string;
}
