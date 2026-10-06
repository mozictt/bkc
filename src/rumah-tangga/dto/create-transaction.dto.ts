import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsDateString,
  IsBoolean,
  MaxLength,
  Min,
} from 'class-validator';
import { TransactionType } from '../constants/transaction-type.enum';

export class CreateTransactionDto {
  @ApiProperty({
    example: TransactionType.EXPENSE,
    enum: TransactionType,
    description: 'Tipe transaksi: INCOME atau EXPENSE',
  })
  @IsNotEmpty()
  @IsEnum(TransactionType)
  type: TransactionType;

  @ApiProperty({ example: 1, description: 'ID kategori' })
  @IsNotEmpty()
  @IsNumber()
  categoryId: number;

  @ApiPropertyOptional({ example: 1, description: 'ID anggota keluarga yang melakukan transaksi' })
  @IsOptional()
  @IsNumber()
  familyMemberId?: number;

  @ApiProperty({ example: 'Belanja di Indomaret', description: 'Deskripsi transaksi' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  description: string;

  @ApiProperty({ example: 150000, description: 'Nominal dalam Rupiah (tanpa desimal)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ example: '2026-10-06', description: 'Tanggal transaksi (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString()
  transactionDate: string;

  @ApiPropertyOptional({ example: 'Beli susu dan roti', description: 'Catatan tambahan' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ example: false, description: 'Apakah pengeluaran rutin (listrik, air, cicilan)?' })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}
