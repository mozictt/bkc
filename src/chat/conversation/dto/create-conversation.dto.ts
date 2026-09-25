import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { ConversationType } from '../../enums/chat.enum';

export class CreateConversationDto {
  @ApiProperty({
    enum: ConversationType,
    description: 'Tipe percakapan: direct (1-on-1) atau group',
    example: ConversationType.DIRECT,
  })
  @IsEnum(ConversationType)
  type: ConversationType;

  @ApiPropertyOptional({
    description: 'Nama grup (wajib diisi jika type=group)',
    example: 'Tim Backend',
  })
  @ValidateIf((o) => o.type === ConversationType.GROUP)
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @ApiProperty({
    description: 'Daftar ID user peserta. Untuk direct: 1 user saja. Untuk group: minimal 2 user.',
    example: [2, 3, 4],
    type: [Number],
  })
  @IsArray()
  @IsInt({ each: true })
  participantIds: number[];
}
