import { IsNotEmpty, IsString } from 'class-validator';

export class CreateKategoriDto {
  @IsString()
  @IsNotEmpty()
  nama: string;
}