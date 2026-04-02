import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeUsernameDto } from './dto/change-username.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

type ReqUser = { sub: string; username: string };

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Get('me')
  me(@Req() req: { user: ReqUser }) {
    return this.auth.me(req.user.sub);
  }

  @Patch('me/password')
  changePassword(@Req() req: { user: ReqUser }, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(req.user.sub, dto);
  }

  @Patch('me/username')
  changeUsername(@Req() req: { user: ReqUser }, @Body() dto: ChangeUsernameDto) {
    return this.auth.changeUsername(req.user.sub, dto.newUsername, dto.currentPassword);
  }
}
