import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQuery } from '../../../../../shared/presentation/http/pagination.js';
import { EventStatus } from '../../../domain/value-objects/event-status.js';

export class ListMyEventsQuery extends PaginationQuery {
  @ApiPropertyOptional({
    enum: EventStatus,
    enumName: 'EventStatus',
    description: 'Sem filtro, traz eventos em qualquer status.',
  })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
