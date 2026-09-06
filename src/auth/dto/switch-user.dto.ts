import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class SwitchUserDto {
  @ApiProperty({ example: 45, description: 'ID User target dari tenant anak yang akan di-switch (impersonate)' })
  @IsNotEmpty({ message: 'ID User target wajib diisi' })
  targetUserId: number | string;
}
