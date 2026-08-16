import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, Min, Max, IsIn, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum MediaTypeEnum {
  PHOTO = 'photo',
  VIDEO = 'video',
}

export class QueryGalleryDto {
  @ApiPropertyOptional({ example: 1, default: 1, description: 'Nomor halaman pagination' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 24, default: 24, description: 'Jumlah data per halaman (Max 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 24;

  @ApiPropertyOptional({ example: 'kegiatan', description: 'Pencarian kata kunci pada nama file media' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter berdasarkan ID Album (UUID atau "uncategorized")' })
  @IsOptional()
  @IsString()
  albumId?: string;

  @ApiPropertyOptional({ enum: MediaTypeEnum, description: 'Filter berdasarkan tipe media (photo atau video)' })
  @IsOptional()
  @IsEnum(MediaTypeEnum, { message: 'type harus berupa photo atau video' })
  type?: MediaTypeEnum;

  @ApiPropertyOptional({ example: 'createdAt', description: 'Kolom pengurutan data (createdAt, originalName, size)' })
  @IsOptional()
  @IsString()
  @IsIn(['createdAt', 'originalName', 'size'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ example: 'desc', description: 'Arah pengurutan (asc/desc atau ASC/DESC)' })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc', 'ASC', 'DESC'])
  sortType?: 'asc' | 'desc' | 'ASC' | 'DESC' = 'desc';
}
