import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreateMenuDto {
  @ApiProperty({ example: 'Sample Name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: '/dashboard', required: false, nullable: true })
  @IsOptional()
  @IsString()
  url?: string;

  @ApiProperty({ example: 'icon-name', required: false, nullable: true })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ example: 1, required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  order_no?: number;

  @ApiProperty({ example: 1, required: false, nullable: true })
  @IsOptional()
  @IsNumber()
  parent_id?: number;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({ example: true, required: false })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}

