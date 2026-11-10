import { Seeder } from 'typeorm-extension';
import { DataSource, IsNull } from 'typeorm';
import { Penjamin } from '../entities/penjamin.entity';
import { JenisPenjamin } from '../master-simrs/constants/simrs.enum';

export default class PenjaminSeeder implements Seeder {
  public async run(dataSource: DataSource): Promise<void> {
    const repository = dataSource.getRepository(Penjamin);

    const defaults = [
      {
        kode: 'UMUM',
        nama: 'Umum / Pribadi',
        jenisPenjamin: JenisPenjamin.UMUM,
        butuhNoKartu: false,
        status: 'Y',
      },
      {
        kode: 'BPJS',
        nama: 'BPJS Kesehatan',
        jenisPenjamin: JenisPenjamin.BPJS,
        butuhNoKartu: true,
        status: 'Y',
      },
      {
        kode: 'JASARAHARJA',
        nama: 'Jasa Raharja',
        jenisPenjamin: JenisPenjamin.ASURANSI_SWASTA,
        butuhNoKartu: true,
        status: 'Y',
      },
      {
        kode: 'KEMENKES',
        nama: 'Jaminan Kementerian Kesehatan',
        jenisPenjamin: JenisPenjamin.KEMENKES,
        butuhNoKartu: false,
        status: 'Y',
      },
    ];

    for (const item of defaults) {
      const existing = await repository.findOne({
        where: { kode: item.kode, tenantId: IsNull() },
        select: ['id'],
      });
      if (!existing) {
        await repository.save(repository.create({ ...item, tenantId: null }));
      }
    }
  }
}

