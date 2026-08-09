import {
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AccessLevel } from '../../permissions/constants/access-level.constant';

export class PermissionItemDto {
  @ApiProperty({ example: 'Barang', description: 'Nama Resource yang ingin diberi akses' })
  @IsString()
  @IsNotEmpty()
  resource: string;

  @ApiProperty({ enum: AccessLevel, example: AccessLevel.FULL_AKSES, description: 'Tingkat akses untuk resource ini' })
  @IsEnum(AccessLevel, {
    message: `AccessLevel harus merupakan salah satu dari: ${Object.values(AccessLevel).join(', ')}`,
  })
  accessLevel: AccessLevel;
}

export class AddPermissionsDto {
  @ApiProperty({ example: 17, description: 'ID dari Role yang akan diupdate' })
  @IsNotEmpty()
  @IsNumber()
  role_id: number;

  @ApiProperty({
    type: () => [PermissionItemDto],
    description: 'Daftar permissions yang akan ditambahkan',
    example: [
      { resource: 'Barang', accessLevel: 'full-akses' },
      { resource: 'Gallery', accessLevel: 'view-akses' }
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionItemDto)
  permissions: PermissionItemDto[];
}
