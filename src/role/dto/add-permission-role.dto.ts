// add-permissions.dto.ts
import {
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MenuAction } from '@entities/enums/menu-action.enum';

export class PermissionItemDto {
  @IsNotEmpty()
  @IsNumber()
  menu_id: number;

  @IsArray({ message: 'Actions harus berupa sebuah array' })
  @IsEnum(MenuAction, {
    each: true,
    message: `Action harus merupakan salah satu dari nilai berikut: ${Object.values(MenuAction).join(', ')}`,
  })
  actions: MenuAction[];
}

export class AddPermissionsDto {
  @IsNotEmpty()
  @IsNumber()
  role_id: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PermissionItemDto)
  permissions: PermissionItemDto[];
}
