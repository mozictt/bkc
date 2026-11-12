import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  ValueTransformer,
} from 'typeorm';
import { TenantNoSoftDeleteBaseEntity } from './tenant-base.entity';
import type { Dokter } from './dokter.entity';
import type { Unit } from './unit.entity';

const timeColumnTransformer: ValueTransformer = {
  to: (value: string | null | undefined) => value ?? null,
  from: (value: string | null | undefined) =>
    typeof value === 'string' && value.length >= 5
      ? value.slice(0, 5)
      : (value ?? null),
};

@Entity('jadwal_dokter')
@Index('idx_jadwal_dokter_tenant_dokter_hari', ['tenantId', 'dokterId', 'hari'])
@Index('idx_jadwal_dokter_tenant_unit_hari', ['tenantId', 'unitId', 'hari'])
@Index(
  'uq_jadwal_dokter_tenant_aktif_slot',
  ['tenantId', 'dokterId', 'unitId', 'hari', 'jamMulai', 'jamSelesai'],
  {
    unique: true,
    where: `"status" = 'Y'`,
  },
)
export class JadwalDokter extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'dokter_id', type: 'int' })
  dokterId: number;

  @ManyToOne('Dokter', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'dokter_id' })
  dokter: Dokter;

  @Index()
  @Column({ name: 'unit_id', type: 'int' })
  unitId: number;

  @ManyToOne('Unit', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Index()
  @Column({ type: 'varchar', length: 15 })
  hari: string;

  @Column({ name: 'hari_urutan', type: 'smallint' })
  hariUrutan: number;

  @Column({
    name: 'jam_mulai',
    type: 'time',
    transformer: timeColumnTransformer,
  })
  jamMulai: string;

  @Column({
    name: 'jam_selesai',
    type: 'time',
    transformer: timeColumnTransformer,
  })
  jamSelesai: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  sesi: string | null;

  @Column({ type: 'varchar', length: 60, nullable: true })
  ruangan: string | null;

  @Column({ name: 'kuota_jkn', type: 'int', default: 0 })
  kuotaJkn: number;

  @Column({ name: 'kuota_non_jkn', type: 'int', default: 0 })
  kuotaNonJkn: number;

  @Column({ name: 'kuota_total', type: 'int', default: 0 })
  kuotaTotal: number;

  @Column({ name: 'durasi_per_pasien', type: 'int', nullable: true })
  durasiPerPasien: number | null;

  @Column({
    name: 'kode_jadwal_bpjs',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  kodeJadwalBpjs: string | null;

  @Column({
    name: 'ihs_schedule_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  ihsScheduleId: string | null;

  @Column({ type: 'text', nullable: true })
  keterangan: string | null;

  @Index()
  @Column({ type: 'varchar', length: 1, default: 'Y' })
  status: string;
}
