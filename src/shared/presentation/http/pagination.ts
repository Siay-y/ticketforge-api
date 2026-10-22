import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import type { Page } from '../../application/pagination.js';

// Teto de página: offsets muito profundos obrigam o banco a percorrer e descartar linhas.
const MAX_PAGE = 10_000;
const MAX_LIMIT = 100;

export class PaginationQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1, maximum: MAX_PAGE })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE)
  page: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: MAX_LIMIT })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = 20;
}

export class PaginationMetaResponse {
  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 42 })
  totalItems: number;

  @ApiProperty({ example: 3 })
  totalPages: number;

  @ApiProperty({ example: true })
  hasNextPage: boolean;

  @ApiProperty({ example: false })
  hasPreviousPage: boolean;

  static from(page: Page<unknown>): PaginationMetaResponse {
    return Object.assign(new PaginationMetaResponse(), {
      page: page.page,
      limit: page.limit,
      totalItems: page.totalItems,
      totalPages: page.totalPages,
      hasNextPage: page.page < page.totalPages,
      hasPreviousPage: page.page > 1,
    });
  }
}
