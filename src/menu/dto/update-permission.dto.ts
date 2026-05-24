import { IsNumber, IsArray, IsEnum } from 'class-validator';
import { MenuAction } from '@entities/enums/menu-action.enum';

export class UpdatePermissionDto {
  @IsNumber() // Memastikan roleId harus angka
  roleId: number;

  @IsNumber() // Memastikan menuId harus angka
  menuId: number;

  @IsArray()
  @IsEnum(MenuAction, { each: true }) // Memastikan isi array hanya enum yang valid
  actions: MenuAction[];
}