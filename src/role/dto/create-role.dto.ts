import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AccessLevel } from '../../permissions/constants/access-level.constant';

class PermissionInputDto {
  @ApiProperty({ example: 'example_value' })
  @IsString()
  @IsNotEmpty()
  resource: string;

  @ApiProperty({ example: 'example_value' })
  @IsEnum(AccessLevel, {
    message: `AccessLevel harus merupakan salah satu dari: ${Object.values(AccessLevel).join(', ')}`,
  })
  accessLevel: AccessLevel;
}

export class CreateRoleDto {
  @ApiProperty({ example: 'Sample Name' })
  @IsString({ message: 'Nama role harus berupa teks.' })
  @IsNotEmpty({ message: 'Nama role tidak boleh kosong.' })
  @MinLength(3, { message: 'Nama role minimal 3 karakter.' })
  @MaxLength(50, { message: 'Nama role maksimal 50 karakter.' })
  name: string;

  @ApiProperty({ example: 'Sample Description' })
  @IsString({ message: 'Deskripsi harus berupa teks.' })
  @IsOptional()
  @MaxLength(255, { message: 'Deskripsi maksimal 255 karakter.' })
  description?: string;

  @ApiProperty({ example: [] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionInputDto)
  @IsOptional()
  permissions?: PermissionInputDto[];
}
