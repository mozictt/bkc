// src/company-profile/dto/update-company-profile.dto.ts
import { PartialType } from '@nestjs/swagger';
import { CreateCompanyProfileDto } from './create-company-profile.dto';

/**
 * Semua field menjadi opsional saat update.
 * PartialType dari @nestjs/swagger otomatis mewarisi dekorasi ApiPropertyOptional.
 */
export class UpdateCompanyProfileDto extends PartialType(CreateCompanyProfileDto) {}
