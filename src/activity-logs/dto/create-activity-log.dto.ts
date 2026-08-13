import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt } from 'class-validator';

export class CreateActivityLogDto {
  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  @IsOptional()
  @IsString()
  tenantId?: string | null;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  userId?: number | null;

  @ApiPropertyOptional({ example: 'admin' })
  @IsOptional()
  @IsString()
  username?: string | null;

  @ApiProperty({ example: 'CREATE', description: 'Nama aksi (misal: CREATE, UPDATE, DELETE, LOGIN, LOGOUT)' })
  @IsString()
  action: string;

  @ApiProperty({ example: 'BARANG', description: 'Nama modul aplikasi' })
  @IsString()
  module: string;

  @ApiPropertyOptional({ example: 'Menambahkan barang baru: Laptop Asus' })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: '127.0.0.1' })
  @IsOptional()
  @IsString()
  ipAddress?: string | null;

  @ApiPropertyOptional({ example: 'Mozilla/5.0...' })
  @IsOptional()
  @IsString()
  userAgent?: string | null;

  @ApiPropertyOptional({ example: 'POST' })
  @IsOptional()
  @IsString()
  method?: string | null;

  @ApiPropertyOptional({ example: '/api/v1/barang' })
  @IsOptional()
  @IsString()
  path?: string | null;

  @ApiPropertyOptional({ example: { id: 1 }, description: 'Parameter URL atau Query string' })
  @IsOptional()
  params?: Record<string, any> | null;

  @ApiPropertyOptional({ example: { nama: 'Laptop' }, description: 'Payload Request Body yang telah disanitasi' })
  @IsOptional()
  body?: Record<string, any> | null;
}
