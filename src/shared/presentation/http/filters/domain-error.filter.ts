import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  DomainError,
  type DomainErrorKind,
} from '../../../domain/errors/domain-error.js';
import type { ErrorResponse } from '../error.response.js';

const STATUS_BY_KIND: Record<DomainErrorKind, HttpStatus> = {
  validation: HttpStatus.BAD_REQUEST,
  business_rule: HttpStatus.UNPROCESSABLE_ENTITY,
  conflict: HttpStatus.CONFLICT,
  not_found: HttpStatus.NOT_FOUND,
  unauthorized: HttpStatus.UNAUTHORIZED,
  forbidden: HttpStatus.FORBIDDEN,
};

@Catch(DomainError)
export class DomainErrorFilter implements ExceptionFilter<DomainError> {
  catch(error: DomainError, host: ArgumentsHost): void {
    const statusCode = STATUS_BY_KIND[error.kind];
    const body: ErrorResponse = {
      statusCode,
      error: error.code,
      message: error.message,
    };

    host.switchToHttp().getResponse<Response>().status(statusCode).json(body);
  }
}
