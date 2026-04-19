import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { KategoriBarang } from '@entities/kategori-barang.entity';
import { TenantBaseEntity } from './tenant-base.entity';

@Entity('barang')
export class Barang extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  nama: string;

  @Column('int')
  harga: number;

  @Column('int')
  stok: number;

  @Column({ nullable: true })
  deskripsi: string;

  @ManyToOne(() => KategoriBarang, (kategori) => kategori.barang)
  @JoinColumn({ name: 'id_kategori_barang' })
  kategori: KategoriBarang;
}
