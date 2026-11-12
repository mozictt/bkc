import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { TenantNoSoftDeleteBaseEntity } from './tenant-base.entity';
import type { LabParameterRujukan } from './lab-parameter-rujukan.entity';
import type { LabTindakanParameter } from './lab-tindakan-parameter.entity';

/**
 * Master parameter pemeriksaan laboratorium (mis: Hemoglobin, Leukosit, Trombosit)
 * yang dapat dipetakan ke satu atau banyak tindakan/paket tarif lab (mis: Darah Lengkap).
 */
@Entity('master_lab_parameter')
@Index('uq_lab_parameter_tenant_kode', ['tenantId', 'kode'], { unique: true })
@Index('uq_lab_parameter_tenant_nama', ['tenantId', 'nama'], { unique: true })
export class LabParameter extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30 })
  kode: string;

  @Column({ type: 'varchar', length: 150 })
  nama: string;

  @Index()
  @Column({ type: 'varchar', length: 80, nullable: true })
  grup: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  satuan: string | null;

  @Column({
    name: 'tipe_hasil',
    type: 'varchar',
    length: 20,
    default: 'NUMERIC',
  })
  tipeHasil: string;

  @Column({ name: 'opsi_pilihan', type: 'jsonb', nullable: true })
  opsiPilihan: string[] | null;

  @Column({ type: 'int', default: 2 })
  desimal: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  metode: string | null;

  @Column({ name: 'loinc_code', type: 'varchar', length: 30, nullable: true })
  loincCode: string | null;

  @Column({ name: 'urutan_default', type: 'int', default: 0 })
  urutanDefault: number;

  @Column({ type: 'text', nullable: true })
  keterangan: string | null;

  @Column({ type: 'varchar', length: 1, default: 'Y' })
  status: string;

  @OneToMany('LabParameterRujukan', 'parameter')
  rujukanList: LabParameterRujukan[];

  @OneToMany('LabTindakanParameter', 'parameter')
  tindakanMappings: LabTindakanParameter[];
}
