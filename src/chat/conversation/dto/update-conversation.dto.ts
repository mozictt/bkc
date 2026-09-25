import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateConversationDto {
  @ApiPropertyOptional({ description: 'Nama grup baru', example: 'Tim Backend v2' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ description: 'Path avatar grup baru' })
  @IsOptional()
  @IsString()
  avatar?: string;
}
