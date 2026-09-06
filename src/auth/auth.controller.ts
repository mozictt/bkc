import { Controller, Post, Body, UnauthorizedException, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SwitchUserDto } from './dto/switch-user.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from '@auth/public.decorator';
import { MasterTenantGuard } from '../common/guards/master-tenant.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}
  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login pengguna' })
  @ApiResponse({ status: 200, description: 'Login berhasil, mengembalikan access token' })
  @ApiResponse({ status: 401, description: 'Kredensial tidak valid' })
  @ApiResponse({ status: 403, description: 'Akses diblokir oleh sistem keamanan CORS' })
  async login(@Body() loginDto: LoginDto, @Req() req: any) {
    try {
      const user = await this.authService.validateUser(
        loginDto.username,
        loginDto.password,
      );
      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }
      return await this.authService.login(user, req);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      return {
        success: false,
        statusCode: 500,
        message: error.message,
        stack: error.stack,
      };
    }
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh JWT Token' })
  @ApiResponse({ status: 200, description: 'Token baru berhasil diterbitkan' })
  async refresh(@Body() body: { userId: number; refreshToken: string }) {
    return this.authService.refresh(body.userId, body.refreshToken);
  }

  @Post('register')
  @ApiOperation({ summary: 'Registrasi pengguna baru' })
  @ApiResponse({ status: 201, description: 'Pengguna berhasil didaftarkan' })
  async register(@Body() registerDto: RegisterDto) {
    // console.log(registerDto );
    return this.authService.register(registerDto);
  }

  @UseGuards(JwtAuthGuard, MasterTenantGuard)
  @Post('switch-user')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Switch login ke user tenant anak (Khusus Master Tenant Super Admin)' })
  @ApiResponse({ status: 200, description: 'Berhasil switch login ke user target' })
  async switchUser(@Req() req: any, @Body() dto: SwitchUserDto) {
    return this.authService.switchUser(req.user, dto.targetUserId, req);
  }

  @UseGuards(JwtAuthGuard)
  @Post('switch-back')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kembali dari mode Switch User ke akun Master Tenant utama' })
  @ApiResponse({ status: 200, description: 'Berhasil kembali ke akun Master Tenant' })
  async switchBack(@Req() req: any) {
    return this.authService.switchBack(req.user, req);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout pengguna dan kurangi/hapus session' })
  @ApiResponse({ status: 200, description: 'Logout berhasil' })
  async logout(@Req() req: any) {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.split(' ')[1] : '';
    // Req.user didapat dari token JWT
    return this.authService.logout(req.user.userId, token, req);
  }
}
