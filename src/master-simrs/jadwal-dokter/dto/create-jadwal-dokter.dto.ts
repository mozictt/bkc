import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  HariPraktik,
  SesiPraktik,
  StatusAktifMaster,
} from '../../constants/simrs.enum';
import {
  trimOptionalString,
  trimString,
} from '../../helpers/master-entity.helper';

const TIME_HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export abstract class BaseJadwalDokterDto {
  @ApiProperty({
    example: 1,
    description: 'ID Master Dokter (FK ke tabel dokter)',
  })
  @IsNotEmpty({ message: 'ID Dokter wajib diisi' })
  @Type(() => Number)
  @IsInt({ message: 'ID Dokter harus berupa angka bulat' })
  @Min(1, { message: 'ID Dokter tidak valid' })
  dokterId: number;

  @ApiProperty({
    example: 1,
    description: 'ID Master Unit / Poliklinik (FK ke tabel unit)',
  })
  @IsNotEmpty({ message: 'ID Unit wajib diisi' })
  @Type(() => Number)
  @IsInt({ message: 'ID Unit harus berupa angka bulat' })
  @Min(1, { message: 'ID Unit tidak valid' })
  unitId: number;

  @ApiProperty({
    example: '08:00',
    description: 'Jam mulai praktik format 24 jam (HH:mm)',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Jam mulai praktik wajib diisi' })
  @IsString({ message: 'Jam mulai harus berupa teks HH:mm' })
  @Matches(TIME_HH_MM_REGEX, {
    message: 'Format jam mulai harus HH:mm (00:00 - 23:59)',
  })
  jamMulai: string;

  @ApiProperty({
    example: '12:00',
    description: 'Jam selesai praktik format 24 jam (HH:mm)',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Jam selesai praktik wajib diisi' })
  @IsString({ message: 'Jam selesai harus berupa teks HH:mm' })
  @Matches(TIME_HH_MM_REGEX, {
    message: 'Format jam selesai harus HH:mm (00:00 - 23:59)',
  })
  jamSelesai: string;

  @ApiPropertyOptional({
    enum: SesiPraktik,
    example: SesiPraktik.PAGI,
    description: 'Label sesi praktik dokter (PAGI / SIANG / SORE / MALAM)',
  })
  @IsOptional()
  @IsEnum(SesiPraktik, { message: 'Sesi praktik tidak valid' })
  sesi?: SesiPraktik;

  @ApiPropertyOptional({
    example: 'Ruang Poli 1',
    description: 'Nama bilik/ruangan konsultasi di dalam poliklinik (opsional)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString({ message: 'Ruangan harus berupa teks' })
  @MaxLength(60, { message: 'Ruangan maksimal 60 karakter' })
  ruangan?: string;

  @ApiPropertyOptional({
    default: 0,
    example: 20,
    description: 'Kuota pasien BPJS / JKN per sesi praktik',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Kuota JKN harus berupa angka bulat' })
  @Min(0, { message: 'Kuota JKN minimal 0' })
  kuotaJkn?: number;

  @ApiPropertyOptional({
    default: 0,
    example: 10,
    description: 'Kuota pasien Umum / Asuransi Non-JKN per sesi praktik',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Kuota Non-JKN harus berupa angka bulat' })
  @Min(0, { message: 'Kuota Non-JKN minimal 0' })
  kuotaNonJkn?: number;

  @ApiPropertyOptional({
    default: 0,
    example: 30,
    description:
      'Total kuota pasien per sesi (otomatis menjumlahkan kuotaJkn + kuotaNonJkn jika dikosongkan)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Kuota total harus berupa angka bulat' })
  @Min(0, { message: 'Kuota total minimal 0' })
  kuotaTotal?: number;

  @ApiPropertyOptional({
    example: 15,
    description:
      'Estimasi durasi pelayanan per pasien dalam menit (1 - 480 menit)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Durasi per pasien harus berupa angka bulat (menit)' })
  @Min(1, { message: 'Durasi per pasien minimal 1 menit' })
  @Max(480, { message: 'Durasi per pasien maksimal 480 menit' })
  durasiPerPasien?: number;

  @ApiPropertyOptional({
    example: 'HFIS-INT-SENIN-01',
    description: 'Kode referensi jadwal pada BPJS Antrean / HFIS (opsional)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString({ message: 'Kode jadwal BPJS harus berupa teks' })
  @MaxLength(50, { message: 'Kode jadwal BPJS maksimal 50 karakter' })
  kodeJadwalBpjs?: string;

  @ApiPropertyOptional({
    example: 'sch-10009880728-int',
    description: 'Schedule ID dari platform SATUSEHAT Kemenkes (opsional)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString({ message: 'IHS Schedule ID harus berupa teks' })
  @MaxLength(50, { message: 'IHS Schedule ID maksimal 50 karakter' })
  ihsScheduleId?: string;

  @ApiPropertyOptional({
    example: 'Khusus pasien kontrol dan rujukan baru penyakit dalam',
    description: 'Catatan atau keterangan tambahan jadwal praktik',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString({ message: 'Keterangan harus berupa teks' })
  @MaxLength(500, { message: 'Keterangan maksimal 500 karakter' })
  keterangan?: string;

  @ApiPropertyOptional({
    enum: StatusAktifMaster,
    default: StatusAktifMaster.AKTIF,
    example: StatusAktifMaster.AKTIF,
    description: 'Status aktif jadwal dokter (Y/N)',
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster, { message: 'Status hanya boleh Y atau N' })
  status?: StatusAktifMaster;
}

export class CreateJadwalDokterDto extends BaseJadwalDokterDto {
  @ApiProperty({
    enum: HariPraktik,
    example: HariPraktik.SENIN,
    description: 'Hari praktik dokter dalam seminggu',
  })
  @IsNotEmpty({ message: 'Hari praktik wajib diisi' })
  @IsEnum(HariPraktik, { message: 'Hari praktik tidak valid' })
  hari: HariPraktik;
}

export class BulkCreateJadwalDokterDto extends BaseJadwalDokterDto {
  @ApiProperty({
    enum: HariPraktik,
    isArray: true,
    example: [HariPraktik.SENIN, HariPraktik.RABU, HariPraktik.JUMAT],
    description:
      'Daftar hari praktik dokter untuk dibuat sekaligus dalam 1 transaksi atomik',
  })
  @IsArray({ message: 'hariList harus berupa array hari praktik' })
  @ArrayMinSize(1, { message: 'Minimal pilih 1 hari praktik' })
  @ArrayUnique({ message: 'Daftar hari praktik tidak boleh duplikat' })
  @IsEnum(HariPraktik, {
    each: true,
    message: 'Setiap item hariList harus berupa HariPraktik yang valid',
  })
  hariList: HariPraktik[];
}

export class UpdateStatusJadwalDokterDto {
  @ApiProperty({
    enum: StatusAktifMaster,
    example: StatusAktifMaster.NONAKTIF,
    description: 'Status aktif jadwal dokter terbaru (Y/N)',
  })
  @IsNotEmpty({ message: 'Status wajib diisi' })
  @IsEnum(StatusAktifMaster, { message: 'Status hanya boleh Y atau N' })
  status: StatusAktifMaster;

  @ApiPropertyOptional({
    example: 'Jadwal sementara dinonaktifkan selama dokter dinas luar',
    description: 'Alasan perubahan status jadwal dokter',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString({ message: 'Keterangan harus berupa teks' })
  @MaxLength(500, { message: 'Keterangan maksimal 500 karakter' })
  keterangan?: string;
}

