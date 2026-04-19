import { IsNotEmpty, IsString, IsIn, IsOptional } from 'class-validator';

export class CreateKategoriDto {
  @IsString()
  @IsNotEmpty()
  nama: string;

  @IsString()
  @IsOptional()
  @IsIn(['Y', 'N'], { message: 'Status hanya boleh Y atau N' })
  status?: string;
}