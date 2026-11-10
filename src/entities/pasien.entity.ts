import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import type { Penduduk } from './penduduk.entity';
import type { Kelurahan } from './kelurahan.entity';
import type { PasienPenjamin } from './pasien-penjamin.entity';

@Entity('pasien')
@Index('uq_pasien_tenant_norm', ['tenantId', 'noRm'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
@Index('uq_pasien_tenant_penduduk', ['tenantId', 'pendudukId'], {
  unique: true,
  where: '"deleted_at" IS NULL',
})
export class Pasien extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'no_rm', type: 'varchar', length: 30 })
  noRm: string;

  @Index()
  @Column({ name: 'penduduk_id', type: 'int' })
  pendudukId: number;

  @ManyToOne('Penduduk', { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'penduduk_id' })
  penduduk: Penduduk;

  @Index()
  @Column({ name: 'penduduk_ibu_id', type: 'int', nullable: true })
  pendudukIbuId: number | null;

  @ManyToOne('Penduduk', { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'penduduk_ibu_id' })
  pendudukIbu: Penduduk | null;

  @Column({ name: 'is_bayi_baru_lahir', type: 'boolean', default: false })
  isBayiBaruLahir: boolean;

  @Column({
    name: 'is_identitas_tidak_diketahui',
    type: 'boolean',
    default: false,
  })
  isIdentitasTidakDiketahui: boolean;

  @Column({ name: 'alamat_sama_ktp', type: 'boolean', default: true })
  alamatSamaKtp: boolean;

  @Column({ name: 'alamat_domisili', type: 'text', nullable: true })
  alamatDomisili: string | null;

  @Index()
  @Column({
    name: 'id_kelurahan_domisili',
    type: 'varchar',
    length: 13,
    nullable: true,
  })
  idKelurahanDomisili: string | null;

  @ManyToOne('Kelurahan', { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'id_kelurahan_domisili' })
  kelurahanDomisili: Kelurahan | null;

  @Column({ name: 'rt_domisili', type: 'varchar', length: 5, nullable: true })
  rtDomisili: string | null;

  @Column({ name: 'rw_domisili', type: 'varchar', length: 5, nullable: true })
  rwDomisili: string | null;

  @Column({ name: 'nama_pj', type: 'varchar', length: 150, nullable: true })
  namaPj: string | null;

  @Column({ name: 'hubungan_pj', type: 'varchar', length: 50, nullable: true })
  hubunganPj: string | null;

  @Column({ name: 'no_hp_pj', type: 'varchar', length: 20, nullable: true })
  noHpPj: string | null;

  @Column({ name: 'alamat_pj', type: 'text', nullable: true })
  alamatPj: string | null;

  @Column({ name: 'catatan_penting', type: 'text', nullable: true })
  catatanPenting: string | null;

  @Column({ type: 'varchar', length: 1, default: 'Y' })
  status: string;

  @OneToMany('PasienPenjamin', 'pasien')
  penjaminList: PasienPenjamin[];
}

