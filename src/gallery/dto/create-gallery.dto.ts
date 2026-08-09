import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class CreateGalleryDto {
  @ApiProperty({ example: 1 })
  @IsOptional()
  @IsUUID()
  albumId?: string;
}
