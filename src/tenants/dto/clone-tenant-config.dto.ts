import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CloneTenantConfigDto {
  @ApiProperty({
    description: 'ID Tenant asal yang akan diduplikasi konfigurasi menu/role/permission-nya (kosongkan untuk duplikasi dari Master Tenant)',
    example: '00000000-0000-0000-0000-000000000000',
    required: false,
  })
  @IsOptional()
  @IsString()
  sourceTenantId?: string;

  @ApiProperty({
    description: 'ID Tenant tujuan yang akan menerima duplikasi konfigurasi',
    example: '11111111-2222-3333-4444-555555555555',
  })
  @IsNotEmpty({ message: 'Target Tenant ID wajib diisi.' })
  @IsString()
  targetTenantId: string;

  @ApiProperty({ description: 'Duplikasi struktur menu', default: true, required: false })
  @IsOptional()
  @IsBoolean()
  includeMenus?: boolean = true;

  @ApiProperty({ description: 'Duplikasi daftar role (selain Super Admin)', default: true, required: false })
  @IsOptional()
  @IsBoolean()
  includeRoles?: boolean = true;

  @ApiProperty({ description: 'Duplikasi hak akses/permission', default: true, required: false })
  @IsOptional()
  @IsBoolean()
  includePermissions?: boolean = true;

  @ApiProperty({ description: 'Otomatis buat akun User Super Admin baru untuk Tenant Tujuan', default: true, required: false })
  @IsOptional()
  @IsBoolean()
  createSuperAdminUser?: boolean = true;

  @ApiProperty({ description: 'Password opsional untuk user Super Admin baru (jika kosong akan dibuat otomatis)', example: 'Password123!', required: false })
  @IsOptional()
  @IsString()
  customPassword?: string;
}
