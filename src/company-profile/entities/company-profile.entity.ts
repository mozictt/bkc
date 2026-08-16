// src/company-profile/entities/company-profile.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TenantBaseEntity } from '@entities/tenant-base.entity';

/**
 * Entity profil perusahaan (per-tenant).
 * Satu tenant hanya boleh memiliki satu profil perusahaan.
 */
@Entity('company_profiles')
export class CompanyProfile extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  // ─── Identitas Perusahaan ─────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'short_name' })
  shortName: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // ─── Kontak ───────────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 30 })
  phone: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  fax: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  website: string | null;

  // ─── Alamat ───────────────────────────────────────────────────────────────

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  province: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'postal_code' })
  postalCode: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  // ─── Legal & Bisnis ───────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 50, nullable: true })
  npwp: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'nib' })
  nib: string | null;

  @Column({ type: 'date', nullable: true, name: 'founded_at' })
  foundedAt: Date | null;

  // ─── Media / Branding ─────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'logo_path' })
  logoPath: string | null;

  @Column({
    type: 'varchar',
    length: 100,
    nullable: true,
    name: 'logo_filename',
  })
  logoFilename: string | null;

  // ─── Sosial Media ─────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 255, nullable: true })
  instagram: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  facebook: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  twitter: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  linkedin: string | null;
}
