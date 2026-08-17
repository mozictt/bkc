import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import type { Kecamatan } from './kecamatan.entity';

@Entity('kelurahan')
export class Kelurahan {
  @PrimaryColumn({ type: 'varchar', length: 13 })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  @Index()
  nama: string;

  @Column({ name: 'kode_pos', type: 'varchar', length: 5, nullable: true })
  kodePos: string;

  @Column({ name: 'kecamatan_id', type: 'varchar', length: 8 })
  kecamatanId: string;

  @ManyToOne('Kecamatan', 'kelurahan', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'kecamatan_id' })
  kecamatan: Kecamatan;
}
