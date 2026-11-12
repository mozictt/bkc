import { PartialType } from '@nestjs/swagger';
import { CreateJadwalDokterDto } from './create-jadwal-dokter.dto';

export class UpdateJadwalDokterDto extends PartialType(CreateJadwalDokterDto) {}
