import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    example: 1,
    description: 'ID pengguna yang akan melakukan refresh token',
  })
  @IsNotEmpty({ message: 'User ID wajib diisi' })
  @IsNumber({}, { message: 'User ID harus berupa angka' })
  userId: number;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Refresh token JWT yang valid dan belum kadaluarsa',
  })
  @IsNotEmpty({ message: 'Refresh token wajib diisi' })
  @IsString({ message: 'Refresh token harus berupa string' })
  refreshToken: string;
}
