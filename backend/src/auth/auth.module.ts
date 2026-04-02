import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const days = parseInt(config.get<string>('JWT_EXPIRES_DAYS') || '7', 10);
        const expiresInSec = Number.isFinite(days) && days > 0 ? days * 24 * 60 * 60 : 7 * 24 * 60 * 60;
        return {
          secret: config.get<string>('JWT_SECRET') || 'dev-cambiar-jwt-secret',
          signOptions: { expiresIn: expiresInSec },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
