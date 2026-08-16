import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryAlbumDto {
  @ApiPropertyOptional({ example: 1, default: 1, description: 'Nomor halaman pagination' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10, description: 'Jumlah data per halaman' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'Dokumentasi', description: 'Pencarian kata kunci pada nama atau deskripsi album' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'createdAt', description: 'Kolom pengurutan data (createdAt, name, date)' })
  @IsOptional()
  @IsString()
  @IsIn(['createdAt', 'name', 'date'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ example: 'desc', description: 'Arah pengurutan (asc atau desc)' })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc', 'ASC', 'DESC'])
  sortType?: 'asc' | 'desc' | 'ASC' | 'DESC' = 'desc';
}
