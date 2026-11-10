import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { JenisUnit, StatusAktifMaster } from '../../constants/simrs.enum';
import {
  trimOptionalString,
  trimString,
} from '../../helpers/master-entity.helper';

export class CreateUnitDto {
  @ApiProperty({
    example: 'UNIT-MLT',
    description: 'Kode unik unit / ruangan / instalasi per tenant',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Kode unit wajib diisi' })
  @IsString({ message: 'Kode unit harus berupa teks' })
  @MaxLength(30, { message: 'Kode unit maksimal 30 karakter' })
  kode: string;

  @ApiProperty({
    example: 'Bangsal Melati',
    description: 'Nama unit pelayanan / poliklinik / bangsal rawat inap',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Nama unit wajib diisi' })
  @IsString({ message: 'Nama unit harus berupa teks' })
  @MaxLength(120, { message: 'Nama unit maksimal 120 karakter' })
  nama: string;

  @ApiProperty({
    enum: JenisUnit,
    example: JenisUnit.RAWAT_INAP,
    description: 'Kategori pelayanan unit',
  })
  @IsNotEmpty({ message: 'Jenis unit wajib diisi' })
  @IsEnum(JenisUnit, { message: 'Jenis unit tidak valid' })
  jenisUnit: JenisUnit;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID Unit induk (jika unit ini merupakan sub-unit / ruangan)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ID Unit induk harus berupa angka bulat' })
  @Min(1, { message: 'ID Unit induk tidak valid' })
  parentId?: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID Kelas perawatan default untuk unit ini (opsional)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'ID Kelas default harus berupa angka bulat' })
  @Min(1, { message: 'ID Kelas default tidak valid' })
  kelasDefaultId?: number;

  @ApiPropertyOptional({
    example: 'Gedung A',
    description: 'Nama gedung lokasi unit',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(80, { message: 'Nama gedung maksimal 80 karakter' })
  gedung?: string;

  @ApiPropertyOptional({
    example: 'Lantai 2',
    description: 'Posisi lantai unit',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(20, { message: 'Lantai maksimal 20 karakter' })
  lantai?: string;

  @ApiPropertyOptional({
    example: '102',
    description: 'Nomor telepon / ekstensi internal unit',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(/^[0-9+\-\s]+$/, {
    message:
      'Nomor telepon/ekstensi hanya boleh berisi angka, spasi, tanda + atau -',
  })
  @MaxLength(20, { message: 'Nomor telepon/ekstensi maksimal 20 karakter' })
  noTeleponEkstensi?: string;

  @ApiPropertyOptional({
    example: 'INT',
    description: 'Kode Poli BPJS / HFIS (khusus unit poliklinik / IGD)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(20, { message: 'Kode BPJS Poli maksimal 20 karakter' })
  kodeBpjsPoli?: string;

  @ApiPropertyOptional({
    example: 'b017ee54-1234-4a5b-9c8d-112233445566',
    description: 'Location ID dari platform SATUSEHAT Kemenkes',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(50, { message: 'IHS Location ID maksimal 50 karakter' })
  ihsLocationId?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Menandakan apakah unit ini dapat memiliki tempat tidur (bed). Otomatis true untuk RAWAT_INAP, IGD, INTENSIVE, OK jika tidak diisi.',
  })
  @IsOptional()
  @IsBoolean({ message: 'isTersediaBed harus berupa boolean' })
  isTersediaBed?: boolean;

  @ApiPropertyOptional({
    example: 'Ruang rawat inap penyakit dalam wanita',
    description: 'Keterangan tambahan unit',
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
    description: 'Status aktif unit (Y/N)',
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster, { message: 'Status hanya boleh Y atau N' })
  status?: StatusAktifMaster;
}
