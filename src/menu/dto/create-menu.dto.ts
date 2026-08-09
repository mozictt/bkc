import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreateMenuDto {
  @ApiProperty({ example: 'Sample Name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'http://example.com' })
  @IsNotEmpty()
  @IsString()
  url: string;

  @ApiProperty({ example: 'icon-name' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ example: 1 })
  @IsOptional()
  @IsNumber()
  order_no?: number;

  @ApiProperty({ example: 1 })
  @IsOptional()
  @IsNumber()
  parent_id?: number;

  @ApiProperty({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({ example: true })
  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}
