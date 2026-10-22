import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IsFutureDate } from '../../../../../shared/presentation/http/validators/date.validators.js';
import {
  EVENT_TITLE_LENGTH,
  EVENT_VENUE_LENGTH,
  MAX_EVENT_CAPACITY,
  MAX_EVENT_DESCRIPTION_LENGTH,
} from '../../../domain/entities/event.js';
import { CreateTicketBatchRequest } from './ticket-batch.request.js';

const MAX_INITIAL_BATCHES = 20;

export class CreateEventRequest {
  @ApiProperty({ example: 'Festival de Verão 2027', ...EVENT_TITLE_LENGTH })
  @IsString()
  @Length(EVENT_TITLE_LENGTH.min, EVENT_TITLE_LENGTH.max)
  title: string;

  @ApiProperty({
    example: 'Dois dias de música ao ar livre com 30 atrações nacionais.',
    maxLength: MAX_EVENT_DESCRIPTION_LENGTH,
  })
  @IsString()
  @MaxLength(MAX_EVENT_DESCRIPTION_LENGTH)
  description: string;

  @ApiProperty({
    example: 'Allianz Parque, São Paulo - SP',
    ...EVENT_VENUE_LENGTH,
  })
  @IsString()
  @Length(EVENT_VENUE_LENGTH.min, EVENT_VENUE_LENGTH.max)
  venue: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2027-03-15T20:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate({ message: 'eventDate deve ser uma data ISO 8601' })
  @IsFutureDate()
  eventDate: Date;

  @ApiProperty({ example: 10000, minimum: 1, maximum: MAX_EVENT_CAPACITY })
  @IsInt()
  @Min(1)
  @Max(MAX_EVENT_CAPACITY)
  maxCapacity: number;

  @ApiPropertyOptional({
    type: [CreateTicketBatchRequest],
    maxItems: MAX_INITIAL_BATCHES,
    description:
      'Lotes criados junto com o evento, na mesma transação. Se um falhar, nada é gravado.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_INITIAL_BATCHES)
  @ValidateNested({ each: true })
  @Type(() => CreateTicketBatchRequest)
  initialBatches?: CreateTicketBatchRequest[];
}

export class UpdateEventRequest extends PartialType(
  OmitType(CreateEventRequest, ['initialBatches'] as const),
) {}
