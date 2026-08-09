import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, IsEnum, IsNotEmpty } from 'class-validator';
import { AccessLevel } from '../../permissions/constants/access-level.constant';

export class UpdatePermissionDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  roleId: number;

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