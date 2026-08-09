import { IsOptional, IsString, IsNumber, IsBoolean, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({
    example: 'johndoe',
    required: false,
    description: 'Username baru pengguna',
  })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({
    example: 'newpassword123',
    required: false,
    description: 'Password baru (opsional, minimal 6 karakter)',
  })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password?: string;

  @ApiProperty({
    example: 2,
    required: false,
    description: 'ID Role baru untuk pengguna',
  })
  @IsOptional()
  @IsNumber()
  role_id?: number;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Status aktif pengguna (true/false)',
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class ToggleUserStatusDto {
  @ApiProperty({
    example: false,
    description: 'Status keaktifan baru pengguna (true = Aktif, false = Non-aktif)',
  })
  @IsBoolean()
  is_active: boolean;
}

export class ResetPasswordDto {
  @ApiProperty({
    example: 'password123',
    required: false,
    description: 'Password baru pengguna (default: password123 jika tidak dikirim)',
  })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  new_password?: string;
}
