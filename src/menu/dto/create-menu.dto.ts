import { IsNotEmpty, IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class CreateMenuDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  url: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsNumber()
  order_no?: number;

  @IsOptional()
  @IsNumber()
  parent_id?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}
