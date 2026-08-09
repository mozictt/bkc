import { IsNotEmpty, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum CopyPermissionMode {
  OVERWRITE = 'overwrite',
  MERGE = 'merge',
}

export class CopyRolePermissionsDto {
  @ApiProperty({
    example: 1,
    description: 'ID dari Role sumber yang hak aksesnya akan disalin (misal: Super Admin)',
  })
  @IsNotEmpty()
  @IsNumber()
  source_role_id: number;

  @ApiProperty({
    example: 17,
    description: 'ID dari Role tujuan yang akan menerima hak akses hasil salinan',
  })
  @IsNotEmpty()
  @IsNumber()
  target_role_id: number;

  @ApiProperty({
    enum: CopyPermissionMode,
    example: CopyPermissionMode.OVERWRITE,
    required: false,
    description:
      'Mode penyalinan: "overwrite" (menghapus permission lama role tujuan) atau "merge" (menggabungkan permission)',
  })
  @IsOptional()
  @IsEnum(CopyPermissionMode, {
    message: `Mode harus salah satu dari: ${Object.values(CopyPermissionMode).join(', ')}`,
  })
  mode?: CopyPermissionMode = CopyPermissionMode.OVERWRITE;
}
