import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let jwtService: { verifyAsync: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };

  const executionContext = (headers: Record<string, string>, isPublic = false) => {
    const request = { headers };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => 'handler',
      getClass: () => 'class',
    } as any;
  };

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    reflector = { getAllAndOverride: jest.fn((key) => (key === 'isPublic' ? false : undefined)) };
    guard = new JwtAuthGuard(jwtService as unknown as JwtService, reflector as unknown as Reflector);
  });

  it('rejects a request without an Authorization header (401)', async () => {
    await expect(guard.canActivate(executionContext({}))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a non-Bearer Authorization header (401)', async () => {
    await expect(
      guard.canActivate(executionContext({ authorization: 'Basic abc' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an invalid token (401)', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt malformed'));
    await expect(
      guard.canActivate(executionContext({ authorization: 'Bearer bad-token' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired token (401)', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    await expect(
      guard.canActivate(executionContext({ authorization: 'Bearer expired-token' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a valid token and attaches the normalized user', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', email: 'a@b.com', role: 'user' });
    const context = executionContext({ authorization: 'Bearer good-token' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(context.switchToHttp().getRequest().user).toEqual({
      id: 'user-1',
      email: 'a@b.com',
      role: 'user',
    });
  });

  it('allows @Public() routes without a token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(executionContext({}, true))).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });
});
