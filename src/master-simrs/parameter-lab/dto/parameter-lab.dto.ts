import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  JenisKelaminRujukanLab,
  StatusAktifMaster,
  TipeHasilLab,
} from '../../constants/simrs.enum';
import {
  trimOptionalString,
  trimString,
} from '../../helpers/master-entity.helper';

const toOptionalNullableNumber = ({ value }: { value: unknown }) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return Number(value);
};

export class CreateLabRujukanDto {
  @ApiPropertyOptional({
    enum: JenisKelaminRujukanLab,
    default: JenisKelaminRujukanLab.ALL,
    description: 'Jenis kelamin target (ALL, L, atau P)',
  })
  @IsOptional()
  @IsEnum(JenisKelaminRujukanLab, {
    message: 'Jenis kelamin rujukan harus ALL, L, atau P',
  })
  jenisKelamin?: JenisKelaminRujukanLab = JenisKelaminRujukanLab.ALL;

  @ApiPropertyOptional({
    default: 0,
    example: 5110,
    description: 'Usia minimum dalam hari (default 0)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Usia minimum (hari) harus berupa angka bulat' })
  @Min(0)
  usiaMinHari?: number = 0;

  @ApiPropertyOptional({
    default: 99999,
    example: 99999,
    description: 'Usia maksimum dalam hari (default 99999)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Usia maksimum (hari) harus berupa angka bulat' })
  @Min(0)
  usiaMaxHari?: number = 99999;

  @ApiPropertyOptional({
    example: 'Dewasa (>= 14 Thn)',
    description: 'Label rentang usia yang ramah tampilan',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(60)
  labelUsia?: string;

  @ApiPropertyOptional({ example: 13.5, nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableNumber)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber({ maxDecimalPlaces: 4 })
  nilaiMin?: number | null;

  @ApiPropertyOptional({ example: 17.5, nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableNumber)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber({ maxDecimalPlaces: 4 })
  nilaiMax?: number | null;

  @ApiPropertyOptional({ example: 7.0, nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableNumber)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber({ maxDecimalPlaces: 4 })
  kritisMin?: number | null;

  @ApiPropertyOptional({ example: 21.0, nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableNumber)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsNumber({ maxDecimalPlaces: 4 })
  kritisMax?: number | null;

  @ApiPropertyOptional({
    example: 'Negatif',
    description: 'Nilai normal teks untuk tipe OPTION/TEXT atau label custom',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(120)
  nilaiNormalText?: string;

  @ApiPropertyOptional({ example: 'Sesuai standar WHO' })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(255)
  keterangan?: string;
}

export class CreateLabParameterDto {
  @ApiProperty({
    example: 'LAB-HB',
    description: 'Kode unik parameter lab per tenant',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Kode parameter wajib diisi' })
  @IsString()
  @MaxLength(30, { message: 'Kode parameter maksimal 30 karakter' })
  kode: string;

  @ApiProperty({
    example: 'Hemoglobin',
    description: 'Nama parameter pemeriksaan lab',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Nama parameter wajib diisi' })
  @IsString()
  @MaxLength(150, { message: 'Nama parameter maksimal 150 karakter' })
  nama: string;

  @ApiPropertyOptional({
    example: 'Hematologi Rutin',
    description: 'Grup / kelompok tampilan pada lembar hasil lab',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(80)
  grup?: string;

  @ApiPropertyOptional({ example: 'g/dL' })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(30)
  satuan?: string;

  @ApiPropertyOptional({
    enum: TipeHasilLab,
    default: TipeHasilLab.NUMERIC,
  })
  @IsOptional()
  @IsEnum(TipeHasilLab, {
    message: 'Tipe hasil harus NUMERIC, OPTION, atau TEXT',
  })
  tipeHasil?: TipeHasilLab = TipeHasilLab.NUMERIC;

  @ApiPropertyOptional({
    type: [String],
    example: ['Negatif', 'Positif (+)', 'Positif (++)'],
    description: 'Daftar opsi pilihan apabila tipeHasil = OPTION',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @IsString({ each: true })
  opsiPilihan?: string[];

  @ApiPropertyOptional({ default: 2, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(4)
  desimal?: number = 2;

  @ApiPropertyOptional({ example: 'Spectrophotometry' })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(100)
  metode?: string;

  @ApiPropertyOptional({ example: '718-7' })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(30)
  loincCode?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  urutanDefault?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(500)
  keterangan?: string;

  @ApiPropertyOptional({
    enum: StatusAktifMaster,
    default: StatusAktifMaster.AKTIF,
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster)
  status?: StatusAktifMaster = StatusAktifMaster.AKTIF;

  @ApiPropertyOptional({
    type: [CreateLabRujukanDto],
    description: 'Daftar nilai normal rujukan per gender/usia',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CreateLabRujukanDto)
  rujukanList?: CreateLabRujukanDto[];
}

export class UpdateLabParameterDto extends PartialType(CreateLabParameterDto) {}

export class QueryLabParameterDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Cari kode, nama parameter, grup, atau LOINC' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter berdasarkan grup parameter' })
  @IsOptional()
  @IsString()
  grup?: string;

  @ApiPropertyOptional({ enum: TipeHasilLab })
  @IsOptional()
  @IsEnum(TipeHasilLab)
  tipeHasil?: TipeHasilLab;

  @ApiPropertyOptional({ enum: StatusAktifMaster })
  @IsOptional()
  @IsEnum(StatusAktifMaster)
  status?: StatusAktifMaster;

  @ApiPropertyOptional({
    default: 'urutanDefault',
    enum: ['id', 'kode', 'nama', 'grup', 'urutanDefault', 'createdAt'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'urutanDefault';

  @ApiPropertyOptional({ default: 'ASC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortType?: 'ASC' | 'DESC' = 'ASC';
}

export class TindakanParameterMappingItemDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  parameterId: number;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  urutan?: number = 0;

  @ApiPropertyOptional({ example: 'Hematologi Rutin' })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(80)
  subGrupLabel?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isWajib?: boolean = true;
}

export class SaveTindakanParameterMappingDto {
  @ApiProperty({ type: [TindakanParameterMappingItemDto] })
  @IsArray({ message: 'Daftar mapping parameter wajib berupa array' })
  @ArrayMaxSize(100, { message: 'Maksimal 100 parameter per tindakan lab' })
  @ValidateNested({ each: true })
  @Type(() => TindakanParameterMappingItemDto)
  items: TindakanParameterMappingItemDto[];
}

export class QuickAddParameterToTindakanDto extends CreateLabParameterDto {
  @ApiPropertyOptional({ example: 'Hematologi Rutin' })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(80)
  subGrupLabel?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isWajib?: boolean = true;
}
