import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQuery } from '../../../../../shared/presentation/http/pagination.js';
import { OrderStatus } from '../../../domain/value-objects/order-status.js';

export class ListMyOrdersQuery extends PaginationQuery {
  @ApiPropertyOptional({ enum: OrderStatus, enumName: 'OrderStatus' })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
