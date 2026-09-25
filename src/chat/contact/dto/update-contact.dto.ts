import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateContactDto {
  @ApiPropertyOptional({ description: 'Nama alias baru untuk kontak', example: 'Budi Boss' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nickname?: string;

  @ApiPropertyOptional({ description: 'Status blokir kontak', example: true })
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;
}
