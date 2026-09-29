import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { MessageType } from '../../enums/chat.enum';

export class UpdateMessageDto {
  @ApiPropertyOptional({ description: 'Konten teks pesan atau keterangan (caption) yang diperbarui', example: 'Pesan / caption yang sudah diedit' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Nama file attachment yang diperbarui' })
  @IsOptional()
  @IsString()
  attachmentName?: string;

  @ApiPropertyOptional({ description: 'URL attachment yang diperbarui' })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @ApiPropertyOptional({ enum: MessageType, description: 'Tipe pesan jika mengganti berkas (image, video, file, audio)' })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;
}

