import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { StatusPenunjangLab } from '@src/master-simrs/constants/simrs.enum';
import {
  trimOptionalString,
  trimString,
} from '@src/master-simrs/helpers/master-entity.helper';

const toOptionalNullableInt = ({ value }: { value: unknown }) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return Number(value);
};

const toOptionalNullableString = ({ value }: { value: unknown }) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

export class QueryEligibleKunjunganDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Cari No. Registrasi, No. RM, Nama Pasien, atau NIK',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '2026-11-11' })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggalDari harus YYYY-MM-DD' })
  tanggalDari?: string;

  @ApiPropertyOptional({ example: '2026-11-11' })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggalSampai harus YYYY-MM-DD' })
  tanggalSampai?: string;

  @ApiPropertyOptional({
    enum: ['ALL', 'DIPERIKSA', 'BELUM_BAYAR'],
    default: 'ALL',
    description:
      'Filter kandidat: ALL (masih diperiksa atau belum bayar), DIPERIKSA saja, atau BELUM_BAYAR saja',
  })
  @IsOptional()
  @IsEnum(['ALL', 'DIPERIKSA', 'BELUM_BAYAR'])
  filterEligible?: 'ALL' | 'DIPERIKSA' | 'BELUM_BAYAR' = 'ALL';

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitId?: number;
}

export class PreviewTindakanLabDto {
  @ApiProperty({ example: 1, description: 'ID Kunjungan Pendaftaran pasien' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pendaftaranId: number;

  @ApiProperty({
    example: '1,2',
    description: 'Daftar ID TarifTindakan (LABORATORIUM) dipisahkan koma',
  })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n >= 1);
    }
    return [];
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Minimal 1 tindakan lab harus dipilih' })
  @ArrayMaxSize(30, { message: 'Maksimal 30 tindakan lab per preview' })
  @IsInt({ each: true })
  @Min(1, { each: true })
  tindakanIds: number[];

  @ApiPropertyOptional({
    example: 5,
    description: 'ID Unit Laboratorium pelaksana untuk resolusi tarif Unit -> Penjamin -> Kelas',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  unitLabId?: number;
}

export class CreatePenunjangLabHasilInputDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tindakanId: number;

  @ApiPropertyOptional({
    example: 10,
    nullable: true,
    description:
      'ID parameter lab. Kosongkan/null jika tindakan merupakan pemeriksaan tunggal tanpa anakan parameter.',
  })
  @IsOptional()
  @Transform(toOptionalNullableInt)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  parameterId?: number | null;

  @ApiPropertyOptional({ example: '14.2', nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableString)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(255)
  hasilNilai?: string | null;

  @ApiPropertyOptional({ example: 'Sampel adekuat', nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableString)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(255)
  catatan?: string | null;
}

export class CreatePenunjangLabDto {
  @ApiProperty({ example: 1, description: 'ID Kunjungan Pendaftaran pasien' })
  @Type(() => Number)
  @IsInt({ message: 'ID Pendaftaran tidak valid' })
  @Min(1)
  pendaftaranId: number;

  @ApiPropertyOptional({ example: 5, nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableInt)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  unitLabId?: number | null;

  @ApiPropertyOptional({ example: 2, nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableInt)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  dokterLabId?: number | null;

  @ApiPropertyOptional({ example: 3, nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableInt)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  petugasLabId?: number | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isCito?: boolean = false;

  @ApiPropertyOptional({ example: 'Suspek Demam Berdarah' })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(255)
  diagnosaKlinis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(1000)
  catatanKlinis?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(1500)
  kesanLab?: string;

  @ApiProperty({
    type: [Number],
    example: [1, 2],
    description: 'Daftar ID TarifTindakan bertipe LABORATORIUM',
  })
  @IsArray({ message: 'Daftar pemeriksaan lab harus berupa array' })
  @ArrayMinSize(1, { message: 'Pilih minimal 1 pemeriksaan laboratorium' })
  @ArrayMaxSize(30)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  tindakanIds: number[];

  @ApiPropertyOptional({
    type: [CreatePenunjangLabHasilInputDto],
    description: 'Opsional: input hasil parameter langsung saat pendaftaran/order dibuat',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePenunjangLabHasilInputDto)
  hasilInputs?: CreatePenunjangLabHasilInputDto[];

  @ApiPropertyOptional({
    default: false,
    description: 'Jika true, status langsung ditandai SELESAI_INPUT setelah seluruh parameter wajib terisi',
  })
  @IsOptional()
  @IsBoolean()
  tandaiSelesaiInput?: boolean = false;
}

export class SaveHasilPenunjangLabItemDto {
  @ApiProperty({ example: 100, description: 'ID baris PenunjangLabHasil' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id: number;

  @ApiPropertyOptional({ example: '14.5', nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableString)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(255)
  hasilNilai?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableString)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(255)
  catatan?: string | null;
}

export class SaveHasilPenunjangLabDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableInt)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  dokterLabId?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableInt)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  petugasLabId?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableString)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsDateString()
  waktuSampelDiambil?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableString)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(1500)
  kesanLab?: string | null;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  tandaiSelesaiInput?: boolean = false;

  @ApiProperty({ type: [SaveHasilPenunjangLabItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveHasilPenunjangLabItemDto)
  hasilList: SaveHasilPenunjangLabItemDto[];
}

export class VerifyPenunjangLabDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableInt)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsInt()
  @Min(1)
  dokterLabId?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(toOptionalNullableString)
  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @MaxLength(1500)
  kesanLab?: string | null;
}

export class BatalPenunjangLabDto {
  @ApiProperty({ example: 'Permintaan pemeriksaan dibatalkan DPJP' })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Alasan pembatalan wajib diisi' })
  @IsString()
  @MaxLength(500)
  alasan: string;
}

export class QueryPenunjangLabDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Cari No. Lab, No. Registrasi, No. RM, atau Nama Pasien',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '2026-11-11' })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggalDari harus YYYY-MM-DD' })
  tanggalDari?: string;

  @ApiPropertyOptional({ example: '2026-11-11' })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Format tanggalSampai harus YYYY-MM-DD' })
  tanggalSampai?: string;

  @ApiPropertyOptional({ enum: StatusPenunjangLab })
  @IsOptional()
  @IsEnum(StatusPenunjangLab)
  statusLab?: StatusPenunjangLab;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pendaftaranId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  isCito?: boolean;

  @ApiPropertyOptional({
    default: 'waktuOrder',
    enum: ['id', 'noLab', 'waktuOrder', 'statusLab', 'totalTarif'],
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'waktuOrder';

  @ApiPropertyOptional({ default: 'DESC', enum: ['ASC', 'DESC'] })
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortType?: 'ASC' | 'DESC' = 'DESC';
}
