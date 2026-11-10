import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { StatusAktifMaster } from '../../constants/simrs.enum';

const trimOptionalString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class CreatePasienPenjaminItemDto {
  @ApiProperty({
    example: 1,
    description: 'ID Master Penjamin (FK ke tabel penjamin)',
  })
  @IsNotEmpty({ message: 'ID Penjamin wajib diisi' })
  @Type(() => Number)
  @IsInt({ message: 'ID Penjamin harus berupa angka bulat' })
  @Min(1, { message: 'ID Penjamin tidak valid' })
  penjaminId: number;

  @ApiPropertyOptional({
    example: '0001234567890',
    description:
      'Nomor kartu peserta BPJS / polis asuransi (wajib jika master penjamin butuhNoKartu = true)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString({ message: 'Nomor kartu harus berupa teks' })
  @MaxLength(50, { message: 'Nomor kartu maksimal 50 karakter' })
  noKartu?: string;

  @ApiPropertyOptional({
    example: 'KELAS 1',
    description: 'Kelas hak rawat inap',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(30, { message: 'Kelas hak maksimal 30 karakter' })
  kelasHak?: string;

  @ApiPropertyOptional({
    example: 'Puskesmas Coblong',
    description: 'Faskes tingkat 1 / perujuk terdaftar',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsString()
  @MaxLength(120, { message: 'Faskes perujuk maksimal 120 karakter' })
  faskesPerujuk?: string;

  @ApiPropertyOptional({
    example: '2027-12-31',
    description: 'Masa berlaku polis/kartu (YYYY-MM-DD)',
  })
  @IsOptional()
  @Transform(trimOptionalString)
  @IsDateString(
    {},
    { message: 'Format berlaku sampai tidak valid (YYYY-MM-DD)' },
  )
  berlakuSampai?: string;

  @ApiPropertyOptional({
    default: false,
    example: true,
    description: 'Menandai sebagai penjamin utama/default pasien',
  })
  @IsOptional()
  @IsBoolean({ message: 'isUtama harus berupa boolean' })
  isUtama?: boolean;

  @ApiPropertyOptional({
    example: 'Peserta PBI aktif',
    description: 'Catatan tambahan penjamin',
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
    description: 'Status aktif penjamin pasien (Y/N)',
  })
  @IsOptional()
  @IsEnum(StatusAktifMaster, { message: 'Status hanya boleh Y atau N' })
  status?: StatusAktifMaster;
}

export class UpdatePasienPenjaminItemDto extends PartialType(
  CreatePasienPenjaminItemDto,
) {}
