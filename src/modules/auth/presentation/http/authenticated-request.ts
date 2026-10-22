import type { Request } from 'express';
import type { AuthenticatedUser } from '../../application/dtos/authenticated-user.js';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
