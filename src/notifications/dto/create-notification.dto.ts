import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../../entities/notification.entity';

export class CreateNotificationDto {
  @ApiProperty({ description: 'ID pengguna penerima notifikasi' })
  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @ApiPropertyOptional({ description: 'ID tenant (jika ada)' })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({ enum: NotificationType, description: 'Jenis/kategori notifikasi' })
  @IsNotEmpty()
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ description: 'Judul notifikasi' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({ description: 'Konten/isi notifikasi' })
  @IsNotEmpty()
  @IsString()
  body: string;

  @ApiPropertyOptional({ description: 'URL / Path tujuan saat diklik' })
  @IsOptional()
  @IsString()
  actionUrl?: string;

  @ApiPropertyOptional({ description: 'Payload data tambahan dalam format JSON' })
  @IsOptional()
  payload?: Record<string, any>;
}
