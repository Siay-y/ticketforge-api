import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { MAX_TICKETS_PER_ORDER } from '../../../domain/entities/order.js';

export class OrderItemRequest {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  batchId: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: MAX_TICKETS_PER_ORDER })
  @IsInt()
  @Min(1)
  @Max(MAX_TICKETS_PER_ORDER)
  quantity: number;
}

export class PlaceOrderRequest {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  eventId: string;

  @ApiProperty({
    type: [OrderItemRequest],
    description: `Lotes do mesmo evento, cada um uma vez. No máximo ${MAX_TICKETS_PER_ORDER} ingressos no total.`,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TICKETS_PER_ORDER)
  @ArrayUnique((item: OrderItemRequest) => item?.batchId, {
    message: 'items não pode repetir o mesmo batchId',
  })
  @ValidateNested({ each: true })
  @Type(() => OrderItemRequest)
  items: OrderItemRequest[];

  @ApiPropertyOptional({
    example: 'VERAO15',
    description: 'Sem diferenciar maiúsculas.',
  })
  @IsOptional()
  @IsString()
  @Length(3, 32)
  couponCode?: string;
}
