import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Barang } from './barang.entity';

@Entity('kategori_barang')
export class KategoriBarang {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nama: string;

  @OneToMany(() => Barang, (barang) => barang.kategori)
  barang: Barang[];
}