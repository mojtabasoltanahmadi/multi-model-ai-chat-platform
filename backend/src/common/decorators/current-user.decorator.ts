import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { User } from '../../users/user.entity';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: User['role'];
  };
}

/** Returns the authenticated user's JWT payload (id, email, role). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedRequest['user'] => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
