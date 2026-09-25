import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateContactDto {
  @ApiProperty({ description: 'ID user yang ingin ditambahkan sebagai kontak', example: 5 })
  @IsInt()
  contactUserId: number;

  @ApiPropertyOptional({ description: 'Nama alias/panggilan untuk kontak ini', example: 'Budi Kerja' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nickname?: string;
}
