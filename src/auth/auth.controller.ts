// src/auth/auth.controller.ts
import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
// import { AuthGuard } from '@nestjs/passport';
import { Public } from '@auth/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}
  @Public()
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(
      loginDto.username,
      loginDto.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() body: { userId: number; refreshToken: string }) {
    return this.authService.refresh(body.userId, body.refreshToken);
  }

  // @UseGuards(AuthGuard('jwt'))
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    // console.log(registerDto );
    return this.authService.register(registerDto);
  }
}
