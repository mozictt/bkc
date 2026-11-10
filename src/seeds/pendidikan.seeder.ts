import { Seeder, SeederFactoryManager } from 'typeorm-extension';
import { DataSource } from 'typeorm';
import { Pendidikan } from '../entities/pendidikan.entity';

export default class PendidikanSeeder implements Seeder {
  public async run(
    dataSource: DataSource,
    factoryManager: SeederFactoryManager,
  ): Promise<any> {
    const repository = dataSource.getRepository(Pendidikan);

    const data = [
      'Tidak Sekolah',
      'Belum Sekolah',
      'Taman Kanak-kanak (TK)',
      'Sekolah Dasar (SD)',
      'Sekolah Menengah Pertama (SMP)',
      'Sekolah Menengah Atas (SMA)',
      'Diploma I (D1)',
      'Diploma II (D2)',
      'Diploma III (D3)',
      'Diploma IV (D4)',
      'Strata 1 (S1)',
      'Strata 2 (S2)',
      'Strata 3 (S3)',
    ].map((nama) => ({ nama, status: 'Y' }));

    for (const item of data) {
      await repository.upsert(item, ['nama']);
    }
  }
}

