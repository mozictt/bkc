import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';

export class CreateFamilyMemberDto {
  @ApiProperty({ example: 'Budi', description: 'Nama anggota keluarga' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Ayah', description: 'Peran dalam keluarga (Ayah, Ibu, Anak, dll)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  role?: string;
}

export class UpdateFamilyMemberDto {
  @ApiPropertyOptional({ example: 'Budi Santoso' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Ayah' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  role?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
