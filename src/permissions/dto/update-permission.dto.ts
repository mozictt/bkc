import {
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
  IsEnum,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AccessLevel } from '../constants/access-level.constant';

export class UpdatePermissionByIdDto {
  @ApiProperty({
    example: 'Barang',
    required: false,
    description: 'Nama Resource Key baru (opsional)',
  })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiProperty({
    enum: AccessLevel,
    example: AccessLevel.FULL_AKSES,
    description: 'Tingkat akses baru (full-akses, admin-akses, change-akses, view-akses)',
  })
  @IsNotEmpty()
  @IsEnum(AccessLevel, {
    message: `AccessLevel harus salah satu dari: ${Object.values(AccessLevel).join(', ')}`,
  })
  accessLevel: AccessLevel;
}

export class PermissionSyncItemDto {
  @ApiProperty({ example: 'Barang', description: 'Nama Resource Key' })
  @IsString()
  @IsNotEmpty()
  resource: string;

  @ApiProperty({
    enum: AccessLevel,
    example: AccessLevel.FULL_AKSES,
    description: 'Level akses untuk resource ini',
  })
  @IsEnum(AccessLevel, {
    message: `AccessLevel harus salah satu dari: ${Object.values(AccessLevel).join(', ')}`,
  })
  accessLevel: AccessLevel;
}

export class SyncRolePermissionsDto {
  @ApiProperty({ example: 17, description: 'ID dari Role yang akan di-sync' })
  @IsNotEmpty()
  @IsNumber()
  role_id: number;

  @ApiProperty({
    type: () => [PermissionSyncItemDto],
    description: 'Daftar lengkap permissions yang akan di-upsert sekaligus',
    example: [
      { resource: 'User', accessLevel: 'full-akses' },
      { resource: 'Role', accessLevel: 'view-akses' },
      { resource: 'Barang', accessLevel: 'admin-akses' },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionSyncItemDto)
  permissions: PermissionSyncItemDto[];
}
