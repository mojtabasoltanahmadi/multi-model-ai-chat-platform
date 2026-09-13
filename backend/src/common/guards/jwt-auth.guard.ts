import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'user' | 'admin';
}

/**
 * Global guard: rejects requests without a valid, unexpired JWT.
 * Routes decorated with @Public() are skipped.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('برای دسترسی باید وارد حساب خود شوید.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      if (!payload?.sub || !payload?.email) {
        throw new UnauthorizedException('توکن نامعتبر است.');
      }
      // Normalize the JWT claims into the app-wide authenticated-user shape.
      (request as Request & { user: { id: string; email: string; role: JwtPayload['role'] } }).user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      // Covers tampered, malformed and expired tokens alike - clients only
      // get a generic rejection, no reason details.
      throw new UnauthorizedException('توکن نامعتبر یا منقضی شده است.');
    }
    return true;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length).trim() || null;
  }
}
