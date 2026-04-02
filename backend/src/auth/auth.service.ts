import {
  ConflictException,
  ForbiddenException,
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async onModuleInit() {
    await this.users.ensureSeedAdmin();
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByUsername(dto.username);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Usuario o contraseña incorrectos.');
    }
    const payload = { sub: user.id, username: user.username };
    const access_token = await this.jwt.signAsync(payload);
    return {
      access_token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    };
  }

  async register(dto: RegisterDto) {
    if (process.env.ALLOW_PUBLIC_REGISTER !== 'true') {
      throw new ForbiddenException('El registro público está desactivado.');
    }
    const existing = await this.users.findByUsername(dto.username);
    if (existing) {
      throw new ConflictException('Ese nombre de usuario ya existe.');
    }
    const user = await this.users.createUser(dto.username, dto.password, dto.displayName);
    const payload = { sub: user.id, username: user.username };
    const access_token = await this.jwt.signAsync(payload);
    return {
      access_token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    };
  }

  async me(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('La contraseña actual no es correcta.');
    }
    await this.users.updatePasswordHash(userId, dto.newPassword);
    return { ok: true };
  }

  async changeUsername(userId: string, newUsername: string, currentPassword: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('La contraseña actual no es correcta.');
    }
    const normalized = newUsername.trim().toLowerCase();
    const taken = await this.users.findByUsername(normalized);
    if (taken && taken.id !== userId) {
      throw new ConflictException('Ese nombre de usuario ya está en uso.');
    }
    await this.users.updateUsername(userId, normalized);
    const payload = { sub: userId, username: normalized };
    const access_token = await this.jwt.signAsync(payload);
    return {
      access_token,
      user: { id: userId, username: normalized, displayName: user.displayName },
    };
  }
}
