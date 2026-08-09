import { IsNotEmpty, IsString,IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'johndoe', description: 'Username untuk login' })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({ example: 'password123', description: 'Password akun' })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiProperty({ example: 1, description: 'ID Role pengguna' })
  @IsNotEmpty()
  @IsNumber()
  id_role: number;

  @ApiProperty({ example: '00000000-0000-0000-0000-000000000000', description: 'ID Tenant (UUID)' })
  @IsNotEmpty()
  @IsString()
  tenantId: string;
}
