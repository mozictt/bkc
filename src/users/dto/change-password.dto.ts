import { IsString, MinLength, MaxLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'passwordLama123', description: 'Kata sandi saat ini' })
  @IsNotEmpty({ message: 'Kata sandi lama wajib diisi' })
  @IsString()
  oldPassword: string;

  @ApiProperty({ example: 'passwordBaru456', description: 'Kata sandi baru' })
  @IsNotEmpty({ message: 'Kata sandi baru wajib diisi' })
  @IsString()
  @MinLength(8, { message: 'Kata sandi baru minimal harus 8 karakter' })
  @MaxLength(100, { message: 'Kata sandi baru maksimal 100 karakter' })
  newPassword: string;
}
