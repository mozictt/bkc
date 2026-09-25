import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, ValidateIf } from 'class-validator';
import { MessageType } from '../../enums/chat.enum';

export class SendMessageDto {
  @ApiPropertyOptional({
    description: 'Konten teks pesan. Wajib diisi jika type=text.',
    example: 'Halo semua!',
  })
  @ValidateIf((o) => o.type === MessageType.TEXT || !o.type)
  @IsString()
  content?: string;

  @ApiPropertyOptional({
    enum: MessageType,
    description: 'Tipe pesan. Default: text',
    example: MessageType.TEXT,
  })
  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType;

  @ApiPropertyOptional({
    description: 'UUID pesan yang dibalas (untuk fitur thread/reply)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID()
  parentMessageId?: string;

  @ApiPropertyOptional({ description: 'URL attachment (gambar/file/audio)' })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @ApiPropertyOptional({ description: 'Nama file attachment asli' })
  @IsOptional()
  @IsString()
  attachmentName?: string;
}
