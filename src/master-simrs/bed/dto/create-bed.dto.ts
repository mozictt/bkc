import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  StatusAktifMaster,
  StatusKetersediaanBed,
} from '../../constants/simrs.enum';
import {
  trimOptionalString,
  trimString,
} from '../../helpers/master-entity.helper';

export class CreateBedDto {
  @ApiProperty({
    example: 'MLT-101-01',
    description: 'Kode unik tempat tidur per tenant',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Kode bed wajib diisi' })
  @IsString({ message: 'Kode bed harus berupa teks' })
  @MaxLength(30, { message: 'Kode bed maksimal 30 karakter' })
  kode: string;

  @ApiProperty({
    example: 'Bed 01',
    description: 'Nama / nomor tempat tidur',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Nama bed wajib diisi' })
  @IsString({ message: 'Nama bed harus berupa teks' })
  @MaxLength(100, { message: 'Nama bed maksimal 100 karakter' })
  nama: string;

  @ApiProperty({
    example: 1,
    description:
      'ID Master Unit (FK ke tabel unit, harus unit yang mendukung bed)',
  })
  @IsNotEmpty({ message: 'ID Unit wajib diisi' })
  @Type(() => Number)
  @IsInt({ message: 'ID Unit harus berupa angka bulat' })
  @Min(1, { message: 'ID Unit tidak valid' })
  unitId: number;

  @ApiProperty({
    example: 1,
    description: 'ID Master Kelas (FK ke tabel kelas)',
  })
  @IsNotEmpty({ message: 'ID Kelas wajib diisi' })
  @Type(() => Number)
  @IsInt({ message: 'ID Kelas harus berupa angka bulat' })
  @Min(1, { message: 'ID Kelas tidak valid' })
  kelasId: number;

  @ApiPropertyOptional({
    example: 'Kamar 101',
    description: 'Nama / nomor kamar tempat bed berada (opsional)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(80, { message: 'Nama kamar maksimal 80 karakter' })
  namaKamar?: string;

  @ApiPropertyOptional({
    enum: StatusKetersediaanBed,
    default: StatusKetersediaanBed.KOSONG,
    example: StatusKetersediaanBed.KOSONG,
    description: 'Status ketersediaan tempat tidur',
  })
  @IsOptional()
  @IsEnum(StatusKetersediaanBed, {
    message: 'Status ketersediaan bed tidak valid',
  })
  statusKetersediaan?: StatusKetersediaanBed;

  @ApiPropertyOptional({
    default: false,
    example: false,
    description: 'Tandai jika tempat tidur merupakan ruang isolasi',
  })
  @IsOptional()
  @IsBoolean({ message: 'isIsolasi harus berupa boolean' })
  isIsolasi?: boolean;

  @ApiPropertyOptional({
    example: 'c028ff65-1234-4a5b-9c8d-998877665544',
    description: 'Location ID level bed dari platform SATUSEHAT Kemenkes',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(50, { message: 'IHS Location ID maksimal 50 karakter' })
  ihsLocationId?: string;

  @ApiPropertyOptional({
    example: 'Dilengkapi monitor pasien dan oksigen sentral',
    description: 'Keterangan tambahan tempat tidur',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500, { message: 'Keterangan maksimal 500 karakter' })
  keterangan?: string;

  @ApiPropertyOptional({
    enum: StatusAktifMaster,
    default: StatusAktifMaster.AKTIF,
    example: StatusAktifMaster.AKTIF,
    description: 'Status aktif master bed (Y/N)',
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster, { message: 'Status hanya boleh Y atau N' })
  status?: StatusAktifMaster;
}

export class UpdateStatusKetersediaanBedDto {
  @ApiProperty({
    enum: StatusKetersediaanBed,
    example: StatusKetersediaanBed.PEMBERSIHAN,
    description: 'Status ketersediaan bed terbaru',
  })
  @IsNotEmpty({ message: 'Status ketersediaan wajib diisi' })
  @IsEnum(StatusKetersediaanBed, {
    message: 'Status ketersediaan bed tidak valid',
  })
  statusKetersediaan: StatusKetersediaanBed;

  @ApiPropertyOptional({
    example: 'Proses sterilisasi ruangan setelah pasien pulang',
    description: 'Catatan perubahan status bed',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500, { message: 'Keterangan maksimal 500 karakter' })
  keterangan?: string;
}
