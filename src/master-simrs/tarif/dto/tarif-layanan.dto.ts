import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { StatusAktifMaster } from '../../constants/simrs.enum';

const toOptionalNullableInt = ({ value }: { value: unknown }) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return Number(value);
};

const toOptionalNullableTrimmedString = ({ value }: { value: unknown }) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export class TarifKomponenDto {
  @ApiPropertyOptional({
    example: 75000,
    default: 0,
    description: 'Nominal jasa sarana / fasilitas rumah sakit',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Jasa sarana harus berupa angka maksimal 2 desimal' },
  )
  @Min(0, { message: 'Jasa sarana tidak boleh negatif' })
  jasaSarana?: number = 0;

  @ApiPropertyOptional({
    example: 15000,
    default: 0,
    description: 'Nominal bahan habis pakai (BHP)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'BHP harus berupa angka maksimal 2 desimal' },
  )
  @Min(0, { message: 'BHP tidak boleh negatif' })
  bhp?: number = 0;

  @ApiPropertyOptional({
    example: 100000,
    default: 0,
    description: 'Nominal jasa medis dokter',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Jasa dokter harus berupa angka maksimal 2 desimal' },
  )
  @Min(0, { message: 'Jasa dokter tidak boleh negatif' })
  jasaDokter?: number = 0;

  @ApiPropertyOptional({
    example: 25000,
    default: 0,
    description:
      'Nominal jasa tenaga kesehatan non-dokter (perawat/analis/radiografer)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'Jasa nakes harus berupa angka maksimal 2 desimal' },
  )
  @Min(0, { message: 'Jasa nakes tidak boleh negatif' })
  jasaNakes?: number = 0;
}

export class CreateTarifLayananDto extends TarifKomponenDto {
  @ApiPropertyOptional({
    example: 1,
    nullable: true,
    description: 'ID Master Unit (null/kosong berarti berlaku untuk semua unit)',
  })
  @IsOptional()
  @Transform(toOptionalNullableInt)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt({ message: 'ID Unit harus berupa angka bulat' })
  @Min(1, { message: 'ID Unit tidak valid' })
  unitId?: number | null;

  @ApiPropertyOptional({
    example: 2,
    nullable: true,
    description:
      'ID Master Penjamin (null/kosong berarti berlaku untuk semua penjamin)',
  })
  @IsOptional()
  @Transform(toOptionalNullableInt)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt({ message: 'ID Penjamin harus berupa angka bulat' })
  @Min(1, { message: 'ID Penjamin tidak valid' })
  penjaminId?: number | null;

  @ApiPropertyOptional({
    example: 1,
    nullable: true,
    description:
      'ID Master Kelas (null/kosong berarti berlaku untuk semua/non-kelas)',
  })
  @IsOptional()
  @Transform(toOptionalNullableInt)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt({ message: 'ID Kelas harus berupa angka bulat' })
  @Min(1, { message: 'ID Kelas tidak valid' })
  kelasId?: number | null;

  @ApiPropertyOptional({
    example: '2026-01-01',
    description:
      'Tanggal mulai berlaku aturan tarif (YYYY-MM-DD), default hari ini',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Format tanggal berlaku mulai tidak valid (YYYY-MM-DD)' },
  )
  berlakuMulai?: string;

  @ApiPropertyOptional({
    example: '2026-12-31',
    nullable: true,
    description:
      'Tanggal berakhir berlaku aturan tarif (opsional, null jika permanen)',
  })
  @IsOptional()
  @Transform(toOptionalNullableTrimmedString)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString(
    {},
    { message: 'Format tanggal berlaku sampai tidak valid (YYYY-MM-DD)' },
  )
  berlakuSampai?: string | null;

  @ApiPropertyOptional({
    example: 'Tarif khusus pasien IGD dengan penjamin asuransi swasta',
    nullable: true,
    description: 'Catatan aturan tarif (opsional)',
  })
  @IsOptional()
  @Transform(toOptionalNullableTrimmedString)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(500, { message: 'Keterangan maksimal 500 karakter' })
  keterangan?: string | null;

  @ApiPropertyOptional({
    enum: StatusAktifMaster,
    default: StatusAktifMaster.AKTIF,
    description: 'Status aktif aturan tarif (Y/N)',
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster, { message: 'Status hanya boleh Y atau N' })
  status?: StatusAktifMaster;
}

export class UpdateTarifLayananDto extends CreateTarifLayananDto {}

export class BulkCreateTarifLayananDto extends TarifKomponenDto {
  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2],
    description: 'Daftar ID Unit target. Kosongkan untuk berlaku di semua unit.',
  })
  @IsOptional()
  @IsArray({ message: 'unitIds harus berupa array' })
  @ArrayMaxSize(30, { message: 'Maksimal 30 unit per generate massal' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Setiap ID Unit harus berupa angka bulat' })
  @Min(1, { each: true, message: 'ID Unit tidak valid' })
  unitIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    example: [1],
    description:
      'Daftar ID Penjamin target. Kosongkan untuk berlaku di semua penjamin.',
  })
  @IsOptional()
  @IsArray({ message: 'penjaminIds harus berupa array' })
  @ArrayMaxSize(30, { message: 'Maksimal 30 penjamin per generate massal' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Setiap ID Penjamin harus berupa angka bulat' })
  @Min(1, { each: true, message: 'ID Penjamin tidak valid' })
  penjaminIds?: number[];

  @ApiPropertyOptional({
    type: [Number],
    example: [1, 2, 3],
    description:
      'Daftar ID Kelas target. Kosongkan untuk berlaku di semua/non-kelas.',
  })
  @IsOptional()
  @IsArray({ message: 'kelasIds harus berupa array' })
  @ArrayMaxSize(30, { message: 'Maksimal 30 kelas per generate massal' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'Setiap ID Kelas harus berupa angka bulat' })
  @Min(1, { each: true, message: 'ID Kelas tidak valid' })
  kelasIds?: number[];

  @ApiPropertyOptional({
    enum: ['SKIP', 'OVERWRITE'],
    default: 'SKIP',
    description:
      'Perlakuan jika kombinasi sudah ada: SKIP (lewati) atau OVERWRITE (timpa)',
  })
  @IsOptional()
  @IsEnum(['SKIP', 'OVERWRITE'], {
    message: 'modeDuplikat hanya boleh SKIP atau OVERWRITE',
  })
  modeDuplikat?: 'SKIP' | 'OVERWRITE' = 'SKIP';

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal berlaku mulai tidak valid' })
  berlakuMulai?: string;

  @ApiPropertyOptional({ example: null, nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableTrimmedString)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString({}, { message: 'Format tanggal berlaku sampai tidak valid' })
  berlakuSampai?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableTrimmedString)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(500)
  keterangan?: string | null;

  @ApiPropertyOptional({
    enum: StatusAktifMaster,
    default: StatusAktifMaster.AKTIF,
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster)
  status?: StatusAktifMaster;
}
