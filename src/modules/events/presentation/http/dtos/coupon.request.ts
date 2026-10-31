import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { IsFutureDate } from '../../../../../shared/presentation/http/validators/date.validators.js';
import { MAX_COUPON_USES } from '../../../domain/entities/coupon.js';
import { MAX_UNIT_PRICE_CENTS } from '../../../domain/entities/ticket-batch.js';
import { DiscountType } from '../../../domain/value-objects/discount-type.js';

export class CreateCouponRequest {
  @ApiProperty({
    example: 'VERAO15',
    description:
      '3 a 32 caracteres: letras, números, hífen ou sublinhado. Gravado em maiúsculas.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z0-9_-]{3,32}$/, {
    message:
      'code deve ter de 3 a 32 caracteres: letras, números, hífen ou sublinhado',
  })
  code: string;

  @ApiProperty({ enum: DiscountType, enumName: 'DiscountType' })
  @IsEnum(DiscountType)
  discountType: DiscountType;

  @ApiProperty({
    example: 1500,
    description:
      'percentage: pontos-base (1500 = 15%, máximo 10000). fixed_cents: centavos (5000 = R$ 50,00).',
  })
  // O teto de 10000 em percentage é checado no domínio (também 400).
  @IsInt()
  @Min(1)
  @Max(MAX_UNIT_PRICE_CENTS)
  discountValue: number;

  @ApiPropertyOptional({
    example: 100,
    nullable: true,
    description: 'Omitido ou null: usos ilimitados.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_COUPON_USES)
  maxUses?: number | null;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2027-02-28T23:59:59.000Z',
  })
  @Type(() => Date)
  @IsDate({ message: 'expiresAt deve ser uma data ISO 8601' })
  @IsFutureDate()
  expiresAt: Date;
}
