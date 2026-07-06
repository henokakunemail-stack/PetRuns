import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/token.dto';
import { AuthService, AuthResult } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto): Promise<AuthResult> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Public()
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResult> {
    const [, token] = dto.refreshToken.split('.');
    return this.authService.refresh(token);
  }

  @Post('logout')
  @Public()
  async logout(@Body('refreshToken') rt?: string) {
    const token = rt?.split('.')[1] ?? undefined;
    return this.authService.logout(token);
  }
}
