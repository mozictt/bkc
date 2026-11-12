import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  trimOptionalString,
  trimString,
} from '@src/master-simrs/helpers/master-entity.helper';
import { CaraKeluarPasien } from '../constants/pendaftaran.enum';

export class SelesaiPendaftaranDto {
  @ApiPropertyOptional({
    enum: CaraKeluarPasien,
    default: CaraKeluarPasien.PULANG_SEMBUH,
    example: CaraKeluarPasien.PULANG_SEMBUH,
    description: 'Cara keluar / pemulangan pasien',
  })
  @IsOptional()
  @IsEnum(CaraKeluarPasien, { message: 'Cara keluar pasien tidak valid' })
  caraKeluar?: CaraKeluarPasien;

  @ApiPropertyOptional({
    example: '2026-11-11T16:30:00.000Z',
    description:
      'Waktu keluar/discharge pasien (ISO-8601). Jika dikosongkan otomatis menggunakan waktu saat ini.',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString({}, { message: 'Format waktuKeluar tidak valid (ISO-8601)' })
  waktuKeluar?: string;

  @ApiPropertyOptional({
    example: 'Pasien pulang dengan kondisi membaik dan jadwal kontrol ulang',
    description: 'Catatan pemulangan pasien',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(1000, { message: 'Catatan maksimal 1000 karakter' })
  catatan?: string;
}

export class BatalPendaftaranDto {
  @ApiProperty({
    example: 'Pasien mengundurkan diri sebelum diperiksa dokter',
    description: 'Alasan pembatalan kunjungan pasien',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Alasan pembatalan wajib diisi' })
  @IsString()
  @MaxLength(500, { message: 'Alasan pembatalan maksimal 500 karakter' })
  alasan: string;

  @ApiPropertyOptional({
    example: 'Dibatalkan atas permintaan keluarga di loket pendaftaran',
    description: 'Catatan tambahan pembatalan',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(1000, { message: 'Catatan maksimal 1000 karakter' })
  catatan?: string;
}

export class BatalRanapDto {
  @ApiProperty({
    example:
      'Keluarga pasien menolak rawat inap dan memilih tetap rawat jalan/pulang dari IGD',
    description: 'Alasan pembatalan status rawat inap pasien',
  })
  @Transform(trimString)
  @IsNotEmpty({ message: 'Alasan batal rawat inap wajib diisi' })
  @IsString()
  @MaxLength(500, { message: 'Alasan batal rawat inap maksimal 500 karakter' })
  alasan: string;

  @ApiPropertyOptional({
    example: 'Bed dikembalikan ke status KOSONG dan pasien dikembalikan ke IGD',
    description: 'Catatan tambahan pembatalan rawat inap',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(1000, { message: 'Catatan maksimal 1000 karakter' })
  catatan?: string;
}
