import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { createMockRepository } from '../test/mocks';
import { User } from '../users/user.entity';
import { ConfigService } from '@nestjs/config';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findByEmail: jest.Mock; create: jest.Mock };
  let jwtService: { signAsync: jest.Mock };
  let configService: Record<string, jest.Mock>;

  const savedPasswords: string[] = [];

  beforeEach(async () => {
    savedPasswords.length = 0;
    usersService = {
      findByEmail: jest.fn(async (email: string) => null),
      create: jest.fn(async (email: string, passwordHash: string, role: string) => {
        savedPasswords.push(passwordHash);
        return {
          id: 'user-1',
          email,
          passwordHash,
          role,
        } as User;
      }),
    };
    jwtService = { signAsync: jest.fn(async () => 'signed-jwt') };
    configService = {
      get: jest.fn((key: string) =>
        key === 'admin.email'
          ? 'admin@example.com'
          : key === 'admin.password'
            ? 'admin1234'
            : undefined,
      ),
    };
    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  describe('register', () => {
    it('registers a new user and never stores the plain password', async () => {
      const result = await service.register({ email: 'Sara@Example.com ', password: 'password123' });

      expect(usersService.create).toHaveBeenCalledWith('sara@example.com', expect.any(String), 'user');
      expect(result.accessToken).toBe('signed-jwt');
      expect(savedPasswords[0]).not.toBe('password123');
      // bcrypt hashes are detectable by their structure
      expect(savedPasswords[0]).toMatch(/^\$2[aby]\$/);
    });

    it('normalizes the email to lower-case trimmed form', async () => {
      await service.register({ email: '  Mixed@EXAMPLE.com ', password: 'password123' });
      expect(usersService.create).toHaveBeenCalledWith('mixed@example.com', expect.anything(), 'user');
    });

    it('rejects duplicate registration', async () => {
      usersService.findByEmail.mockResolvedValue({ id: 'exists', email: 'sara@example.com' } as User);
      await expect(
        service.register({ email: 'sara@example.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const storedHash = bcrypt.hashSync('password123', 10);

    it('logs in with valid credentials', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'sara@example.com',
        passwordHash: storedHash,
        role: 'user',
      } as User);

      const result = await service.login({ email: 'sara@example.com', password: 'password123' });
      expect(result.accessToken).toBe('signed-jwt');
      expect(result.user.role).toBe('user');
    });

    it('rejects a wrong password', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'sara@example.com',
        passwordHash: storedHash,
        role: 'user',
      } as User);

      await expect(
        service.login({ email: 'sara@example.com', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an unknown user without revealing whether the email exists', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      await expect(
        service.login({ email: 'ghost@example.com', password: 'whatever1' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('admin seeding', () => {
    it('creates the initial admin account when missing', async () => {
      await service.onApplicationBootstrap();
      expect(usersService.create).toHaveBeenCalledWith('admin@example.com', expect.any(String), 'admin');
      expect(savedPasswords[0]).toMatch(/^\$2[aby]\$/);
    });

    it('does not create a second admin when one already exists', async () => {
      usersService.findByEmail.mockResolvedValue({ id: 'admin-1', email: 'admin@example.com' } as User);
      await service.onApplicationBootstrap();
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });
});
