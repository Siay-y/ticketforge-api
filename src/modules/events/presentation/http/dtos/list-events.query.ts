import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQuery } from '../../../../../shared/presentation/http/pagination.js';
import { IsAfterProperty } from '../../../../../shared/presentation/http/validators/date.validators.js';

export class ListEventsQuery extends PaginationQuery {
  @ApiPropertyOptional({
    description: 'Trecho do título ou do local, sem diferenciar maiúsculas.',
    example: 'festival',
    maxLength: 100,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Eventos a partir desta data. Padrão: agora.',
    example: '2027-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'from deve ser uma data ISO 8601' })
  from?: Date;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Eventos até esta data. Deve ser igual ou posterior a from.',
    example: '2027-12-31T23:59:59.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'to deve ser uma data ISO 8601' })
  @IsAfterProperty('from', { allowEqual: true })
  to?: Date;
}
