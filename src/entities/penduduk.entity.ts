import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import type { Kelurahan } from './kelurahan.entity';
import type { Agama } from './agama.entity';
import type { Pendidikan } from './pendidikan.entity';
import type { Pekerjaan } from './pekerjaan.entity';
import type { Suku } from './suku.entity';

@Entity('penduduk')
@Index('uq_penduduk_tenant_nik', ['tenantId', 'nik'], {
  unique: true,
  where: '"deleted_at" IS NULL AND "nik" IS NOT NULL',
})
@Index(
  'uq_penduduk_tenant_identitas_lain',
  ['tenantId', 'jenisIdentitas', 'noIdentitasLain'],
  {
    unique: true,
    where: '"deleted_at" IS NULL AND "no_identitas_lain" IS NOT NULL',
  },
)
export class Penduduk extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'jenis_identitas',
    type: 'varchar',
    length: 30,
    default: 'KTP',
  })
  jenisIdentitas: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  nik: string | null;

  @Column({
    name: 'no_identitas_lain',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  noIdentitasLain: string | null;

  @Column({ name: 'no_kk', type: 'varchar', length: 16, nullable: true })
  noKk: string | null;

  @Index()
  @Column({ name: 'nama_lengkap', type: 'varchar', length: 150 })
  namaLengkap: string;

  @Column({
    name: 'nama_ibu_kandung',
    type: 'varchar',
    length: 150,
    nullable: true,
  })
  namaIbuKandung: string | null;

  @Column({
    name: 'tempat_lahir',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  tempatLahir: string | null;

  @Column({ name: 'tanggal_lahir', type: 'date', nullable: true })
  tanggalLahir: string | null;

  @Column({ name: 'jenis_kelamin', type: 'varchar', length: 1 })
  jenisKelamin: string;

  @Column({
    name: 'golongan_darah',
    type: 'varchar',
    length: 15,
    nullable: true,
  })
  golonganDarah: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  rhesus: string | null;

  @Column({
    name: 'status_perkawinan',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  statusPerkawinan: string | null;

  @Column({ type: 'varchar', length: 10, default: 'WNI' })
  kewarganegaraan: string;

  @Column({
    name: 'status_hidup',
    type: 'varchar',
    length: 20,
    default: 'HIDUP',
  })
  statusHidup: string;

  @Column({ name: 'tanggal_meninggal', type: 'date', nullable: true })
  tanggalMeninggal: string | null;

  @Column({ name: 'alamat_ktp', type: 'text', nullable: true })
  alamatKtp: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  rt: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  rw: string | null;

  @Column({ name: 'kode_pos', type: 'varchar', length: 10, nullable: true })
  kodePos: string | null;

  @Column({ name: 'no_telepon', type: 'varchar', length: 20, nullable: true })
  noTelepon: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  email: string | null;

  @Index()
  @Column({ name: 'id_kelurahan', type: 'varchar', length: 13, nullable: true })
  idKelurahan: string | null;

  @ManyToOne('Kelurahan', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_kelurahan' })
  kelurahan: Kelurahan | null;

  @Index()
  @Column({ name: 'agama_id', type: 'int', nullable: true })
  agamaId: number | null;

  @ManyToOne('Agama', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'agama_id' })
  agama: Agama | null;

  @Index()
  @Column({ name: 'pendidikan_id', type: 'int', nullable: true })
  pendidikanId: number | null;

  @ManyToOne('Pendidikan', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'pendidikan_id' })
  pendidikan: Pendidikan | null;

  @Index()
  @Column({ name: 'pekerjaan_id', type: 'int', nullable: true })
  pekerjaanId: number | null;

  @ManyToOne('Pekerjaan', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'pekerjaan_id' })
  pekerjaan: Pekerjaan | null;

  @Index()
  @Column({ name: 'suku_id', type: 'int', nullable: true })
  sukuId: number | null;

  @ManyToOne('Suku', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'suku_id' })
  suku: Suku | null;

  @Column({
    name: 'ihs_patient_id',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  ihsPatientId: string | null;
}
