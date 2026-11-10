import { Seeder } from 'typeorm-extension';
import { DataSource, IsNull } from 'typeorm';
import { Kelas } from '../entities/kelas.entity';

export default class KelasSeeder implements Seeder {
  public async run(dataSource: DataSource): Promise<void> {
    const repository = dataSource.getRepository(Kelas);

    const defaults = [
      { kode: 'VVP', nama: 'VVIP', urutan: 1, kodeBpjsAplicare: 'VVP' },
      { kode: 'VIP', nama: 'VIP', urutan: 2, kodeBpjsAplicare: 'VIP' },
      { kode: 'KL1', nama: 'Kelas 1', urutan: 3, kodeBpjsAplicare: 'KL1' },
      { kode: 'KL2', nama: 'Kelas 2', urutan: 4, kodeBpjsAplicare: 'KL2' },
      { kode: 'KL3', nama: 'Kelas 3', urutan: 5, kodeBpjsAplicare: 'KL3' },
      { kode: 'ICU', nama: 'ICU', urutan: 6, kodeBpjsAplicare: 'ICU' },
      { kode: 'ISO', nama: 'Isolasi', urutan: 7, kodeBpjsAplicare: 'ISO' },
    ];

    for (const item of defaults) {
      const existing = await repository.findOne({
        where: { kode: item.kode, tenantId: IsNull() },
        select: ['id'],
      });
      if (!existing) {
        await repository.save(
          repository.create({
            ...item,
            status: 'Y',
            tenantId: null,
          }),
        );
      }
    }
  }
}

