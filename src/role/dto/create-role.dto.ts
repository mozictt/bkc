// src/role/dto/create-role.dto.ts
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  IsArray,
  IsInt,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MenuAction } from '@entities/enums/menu-action.enum';

// DTO Mini untuk mendefinisikan permission per menu
class MenuPermissionInputDto {
  @IsInt()
  @IsNotEmpty()
  menu_id: number;

  // Anda bisa sesuaikan field ini dengan struktur di entity RoleMenuPermission Anda
  // Contoh: canCreate, canRead, atau berupa string 'CREATE', 'VIEW'
  @IsArray({ message: 'Actions harus berupa sebuah array' })
  @IsEnum(MenuAction, {
    each: true,
    message: `Action harus merupakan salah satu dari nilai berikut: ${Object.values(MenuAction).join(', ')}`,
  })
  actions: MenuAction[];
}

export class CreateRoleDto {
  @IsString({ message: 'Nama role harus berupa teks.' })
  @IsNotEmpty({ message: 'Nama role tidak boleh kosong.' })
  @MinLength(3, { message: 'Nama role minimal 3 karakter.' })
  @MaxLength(50, { message: 'Nama role maksimal 50 karakter.' })
  name: string;

  @IsString({ message: 'Deskripsi harus berupa teks.' })
  @IsOptional()
  @MaxLength(255, { message: 'Deskripsi maksimal 255 karakter.' })
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuPermissionInputDto)
  @IsOptional()
  permissions?: MenuPermissionInputDto[];
}
