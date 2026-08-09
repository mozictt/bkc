import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class RegisterTenantDto {
  @ApiProperty({ example: 'Klinik Sehat Selalu', description: 'Nama Perusahaan/Klinik' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'klinik-sehat', description: 'Slug unik URL' })
  @IsNotEmpty()
  @IsString()
  slug: string;

  @ApiProperty({ example: 'admin@kliniksehat.com', description: 'Email pemilik tenant' })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
