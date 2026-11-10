import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import type { Penduduk } from './penduduk.entity';
import type { Pegawai } from './pegawai.entity';

@Entity('dokter')
@Index('uq_dokter_tenant_kode', ['tenantId', 'kodeDokter'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('uq_dokter_tenant_penduduk', ['tenantId', 'pendudukId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('uq_dokter_tenant_pegawai', ['tenantId', 'pegawaiId'], {
  unique: true,
  where: '"deleted_at" IS NULL AND "pegawai_id" IS NOT NULL',
})
@Index('uq_dokter_tenant_str', ['tenantId', 'noStr'], {
  unique: true,
  where: '"deleted_at" IS NULL AND "no_str" IS NOT NULL',
})
export class Dokter extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'kode_dokter', type: 'varchar', length: 30 })
  kodeDokter: string;

  @Index()
  @Column({ name: 'penduduk_id', type: 'int' })
  pendudukId: number;

  @ManyToOne('Penduduk', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'penduduk_id' })
  penduduk: Penduduk;

  @Index()
  @Column({ name: 'pegawai_id', type: 'int', nullable: true })
  pegawaiId: number | null;

  @ManyToOne('Pegawai', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'pegawai_id' })
  pegawai: Pegawai | null;

  @Column({ name: 'gelar_depan', type: 'varchar', length: 30, nullable: true })
  gelarDepan: string | null;

  @Column({
    name: 'gelar_belakang',
    type: 'varchar',
    length: 80,
    nullable: true,
  })
  gelarBelakang: string | null;

  @Column({
    name: 'jenis_dokter',
    type: 'varchar',
    length: 30,
    default: 'UMUM',
  })
  jenisDokter: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  spesialisasi: string | null;

  @Column({ name: 'no_str', type: 'varchar', length: 50, nullable: true })
  noStr: string | null;

  @Column({ name: 'is_str_seumur_hidup', type: 'boolean', default: false })
  isStrSeumurHidup: boolean;

  @Column({ name: 'str_terbit_pada', type: 'date', nullable: true })
  strTerbitPada: string | null;

  @Column({ name: 'str_berlaku_sampai', type: 'date', nullable: true })
  strBerlakuSampai: string | null;

  @Column({ name: 'no_sip', type: 'varchar', length: 50, nullable: true })
  noSip: string | null;

  @Column({ name: 'sip_terbit_pada', type: 'date', nullable: true })
  sipTerbitPada: string | null;

  @Column({ name: 'sip_berlaku_sampai', type: 'date', nullable: true })
  sipBerlakuSampai: string | null;

  @Column({
    name: 'ihs_practitioner_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  ihsPractitionerId: string | null;

  @Column({ name: 'kode_bpjs', type: 'varchar', length: 30, nullable: true })
  kodeBpjs: string | null;

  @Column({ type: 'varchar', length: 1, default: 'Y' })
  status: string;
}
