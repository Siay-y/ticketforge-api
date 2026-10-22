import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsInt, IsString, Length, Max, Min } from 'class-validator';
import { IsAfterProperty } from '../../../../../shared/presentation/http/validators/date.validators.js';
import {
  MAX_BATCH_NAME_LENGTH,
  MAX_UNIT_PRICE_CENTS,
} from '../../../domain/entities/ticket-batch.js';
import { MAX_EVENT_CAPACITY } from '../../../domain/entities/event.js';

export class CreateTicketBatchRequest {
  @ApiProperty({
    example: '1º Lote - Meia-entrada',
    maxLength: MAX_BATCH_NAME_LENGTH,
  })
  @IsString()
  @Length(1, MAX_BATCH_NAME_LENGTH)
  name: string;

  @ApiProperty({
    description: 'Preço unitário em centavos (15000 = R$ 150,00).',
    example: 15000,
    minimum: 0,
    maximum: MAX_UNIT_PRICE_CENTS,
  })
  @IsInt({ message: 'unitPriceCents deve ser um inteiro em centavos' })
  @Min(0)
  @Max(MAX_UNIT_PRICE_CENTS)
  unitPriceCents: number;

  @ApiProperty({ example: 500, minimum: 1, maximum: MAX_EVENT_CAPACITY })
  @IsInt()
  @Min(1)
  @Max(MAX_EVENT_CAPACITY)
  totalQuantity: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2027-01-10T12:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate({ message: 'salesStartDate deve ser uma data ISO 8601' })
  salesStartDate: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2027-02-28T23:59:59.000Z',
    description:
      'Posterior a salesStartDate e no máximo igual à data do evento.',
  })
  @Type(() => Date)
  @IsDate({ message: 'salesEndDate deve ser uma data ISO 8601' })
  @IsAfterProperty('salesStartDate')
  salesEndDate: Date;
}

export class UpdateTicketBatchRequest extends PartialType(
  CreateTicketBatchRequest,
) {}
