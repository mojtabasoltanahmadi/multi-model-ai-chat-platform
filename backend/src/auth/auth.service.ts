import {
  ConflictException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Seeds the initial admin account (from env) if no admin exists yet,
   * so the admin panel is reachable out of the box.
   */
  async onApplicationBootstrap() {
    // configuration.ts guarantees defaults for these values.
    const email = this.configService.get<string>('admin.email')!;
    const existing = await this.usersService.findByEmail(email);
    if (existing) return;

    const password = this.configService.get<string>('admin.password')!;
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await this.usersService.create(email, passwordHash, 'admin');
    this.logger.log(`Seeded initial admin account for ${email}`);
  }

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.usersService.findByEmail(email);
    if (existing) {
      throw new ConflictException('این ایمیل قبلاً ثبت شده است.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = await this.usersService.create(email, passwordHash, 'user');
    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.usersService.findByEmail(email);
    // Same generic message for unknown user and wrong password so the
    // endpoint does not reveal which emails exist.
    if (!user) {
      throw new UnauthorizedException('ایمیل یا رمز عبور اشتباه است.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('ایمیل یا رمز عبور اشتباه است.');
    }

    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}
