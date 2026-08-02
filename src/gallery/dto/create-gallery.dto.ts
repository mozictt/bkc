import { IsOptional, IsUUID } from 'class-validator';

export class CreateGalleryDto {
  @IsOptional()
  @IsUUID()
  albumId?: string;
}
