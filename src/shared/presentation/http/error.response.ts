import { ApiProperty } from '@nestjs/swagger';

/** Formato de erro devolvido pela API, usado também na documentação Swagger. */
export class ErrorResponse {
  @ApiProperty({ example: 401 })
  statusCode: number;

  @ApiProperty({ example: 'INVALID_CREDENTIALS' })
  error: string;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'E-mail ou senha inválidos',
  })
  message: string | string[];
}
