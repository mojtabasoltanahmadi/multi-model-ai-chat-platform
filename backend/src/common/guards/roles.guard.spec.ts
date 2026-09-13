import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  const executionContext = (user: unknown) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => 'handler',
      getClass: () => 'class',
    }) as any;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn(() => undefined) };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('allows routes without role restrictions for any authenticated user', () => {
    expect(guard.canActivate(executionContext({ role: 'user' }))).toBe(true);
  });

  it('blocks a normal user from an admin-only endpoint', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(() => guard.canActivate(executionContext({ role: 'user' }))).toThrow(ForbiddenException);
  });

  it('allows an admin into an admin-only endpoint', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(guard.canActivate(executionContext({ role: 'admin' }))).toBe(true);
  });

  it('blocks unauthenticated requests on role-restricted endpoints', () => {
    reflector.getAllAndOverride.mockReturnValue(['admin']);
    expect(() => guard.canActivate(executionContext(undefined))).toThrow(ForbiddenException);
  });
});
