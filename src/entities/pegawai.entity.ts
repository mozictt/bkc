import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantNoSoftDeleteBaseEntity } from './tenant-base.entity';
import type { Kelurahan } from './kelurahan.entity';
import type { Penduduk } from './penduduk.entity';

@Entity('pegawai')
@Index('uq_pegawai_tenant_nip', ['tenantId', 'nip'], { unique: true })
@Index('uq_pegawai_tenant_email', ['tenantId', 'email'], {
  unique: true,
  where: '"email" IS NOT NULL',
})
@Index('uq_pegawai_tenant_penduduk', ['tenantId', 'pendudukId'], {
  unique: true,
  where: '"penduduk_id" IS NOT NULL',
})
export class Pegawai extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'penduduk_id', type: 'int', nullable: true })
  pendudukId: number | null;

  @ManyToOne('Penduduk', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'penduduk_id' })
  penduduk: Penduduk | null;

  @Column()
  nip: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  email: string | null;

  @Column({ name: 'phone_number', type: 'varchar', nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  position: string | null;

  @Column({
    name: 'status_kepegawaian',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  statusKepegawaian: string | null;

  @Column({
    name: 'status_aktif',
    type: 'varchar',
    length: 20,
    default: 'AKTIF',
  })
  statusAktif: string;

  @Column({ name: 'unit_kerja', type: 'varchar', length: 100, nullable: true })
  unitKerja: string | null;

  @Column({ name: 'tanggal_masuk', type: 'date', nullable: true })
  tanggalMasuk: string | null;

  @Column({ name: 'tanggal_keluar', type: 'date', nullable: true })
  tanggalKeluar: string | null;

  @Column({ type: 'varchar', nullable: true })
  avatar: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Index()
  @Column({ name: 'id_kelurahan', type: 'varchar', length: 13, nullable: true })
  idKelurahan: string | null;

  @ManyToOne('Kelurahan', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_kelurahan' })
  kelurahan: Kelurahan | null;
}
