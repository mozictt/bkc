import { IsString, IsNotEmpty, IsArray, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class PermissionDto {
  @IsString()
  @IsNotEmpty()
  menu_id: string;

  @IsArray()
  @IsString({ each: true })
  actions: string[];
}

import { PartialType } from '@nestjs/mapped-types';
import { CreateRoleDto } from './create-role.dto';

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}