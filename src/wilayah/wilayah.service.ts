import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Provinsi } from '@entities/provinsi.entity';
import { Kabupaten } from '@entities/kabupaten.entity';
import { Kecamatan } from '@entities/kecamatan.entity';
import { Kelurahan } from '@entities/kelurahan.entity';
import { QueryWilayahDto, QueryKabupatenDto, QueryKecamatanDto, QueryKelurahanDto } from './dto/query-wilayah.dto';

@Injectable()
export class WilayahService {
  constructor(
    @InjectRepository(Provinsi)
    private readonly provinsiRepo: Repository<Provinsi>,
    @InjectRepository(Kabupaten)
    private readonly kabupatenRepo: Repository<Kabupaten>,
    @InjectRepository(Kecamatan)
    private readonly kecamatanRepo: Repository<Kecamatan>,
    @InjectRepository(Kelurahan)
    private readonly kelurahanRepo: Repository<Kelurahan>,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  // TTL Cache: 1 Hari (86400 detik)
  private readonly CACHE_TTL = 86400;

  // 1. Autocomplete Provinsi
  async searchProvinsi(query: QueryWilayahDto) {
    const searchVal = query.search || '';
    const limitVal = query.limit || 10;
    const cacheKey = `wilayah:provinsi:search:${searchVal.toLowerCase()}:limit:${limitVal}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const qb = this.provinsiRepo.createQueryBuilder('p');
    if (query.search) {
      qb.where('UPPER(p.nama) LIKE :search', { search: `%${query.search.toUpperCase()}%` });
    }
    const data = await qb.orderBy('p.nama', 'ASC').take(limitVal).getMany();

    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', this.CACHE_TTL);
    return data;
  }

  // 2. Autocomplete Kabupaten (bisa difilter berdasarkan Provinsi)
  async searchKabupaten(query: QueryKabupatenDto) {
    const provId = query.provinsiId || '';
    const searchVal = query.search || '';
    const limitVal = query.limit || 10;
    const cacheKey = `wilayah:kabupaten:provinsi:${provId}:search:${searchVal.toLowerCase()}:limit:${limitVal}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const qb = this.kabupatenRepo.createQueryBuilder('k');
    if (query.provinsiId) {
      qb.andWhere('k.provinsiId = :provinsiId', { provinsiId: query.provinsiId });
    }
    if (query.search) {
      qb.andWhere('UPPER(k.nama) LIKE :search', { search: `%${query.search.toUpperCase()}%` });
    }
    const data = await qb.orderBy('k.nama', 'ASC').take(limitVal).getMany();

    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', this.CACHE_TTL);
    return data;
  }

  // 3. Autocomplete Kecamatan (bisa difilter berdasarkan Kabupaten)
  async searchKecamatan(query: QueryKecamatanDto) {
    const kabId = query.kabupatenId || '';
    const searchVal = query.search || '';
    const limitVal = query.limit || 10;
    const cacheKey = `wilayah:kecamatan:kabupaten:${kabId}:search:${searchVal.toLowerCase()}:limit:${limitVal}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const qb = this.kecamatanRepo.createQueryBuilder('kc');
    if (query.kabupatenId) {
      qb.andWhere('kc.kabupatenId = :kabupatenId', { kabupatenId: query.kabupatenId });
    }
    if (query.search) {
      qb.andWhere('UPPER(kc.nama) LIKE :search', { search: `%${query.search.toUpperCase()}%` });
    }
    const data = await qb.orderBy('kc.nama', 'ASC').take(limitVal).getMany();

    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', this.CACHE_TTL);
    return data;
  }

  // 4. Autocomplete Kelurahan (bisa difilter berdasarkan Kecamatan)
  async searchKelurahan(query: QueryKelurahanDto) {
    const kecId = query.kecamatanId || '';
    const searchVal = query.search || '';
    const limitVal = query.limit || 10;
    const cacheKey = `wilayah:kelurahan:kecamatan:${kecId}:search:${searchVal.toLowerCase()}:limit:${limitVal}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const qb = this.kelurahanRepo.createQueryBuilder('kl');
    if (query.kecamatanId) {
      qb.andWhere('kl.kecamatanId = :kecamatanId', { kecamatanId: query.kecamatanId });
    }
    if (query.search) {
      qb.andWhere('UPPER(kl.nama) LIKE :search', { search: `%${query.search.toUpperCase()}%` });
    }
    const data = await qb.orderBy('kl.nama', 'ASC').take(limitVal).getMany();

    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', this.CACHE_TTL);
    return data;
  }

  // 5. Global Autocomplete (Satu kolom cari Kelurahan langsung join ke atas)
  // Menghindari N+1 query dengan melakukan Single Query Join
  async searchGlobal(search: string, limit = 100) {
    if (!search) return [];

    const cacheKey = `wilayah:global:search:${search.toLowerCase()}:limit:${limit}`;
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const items = await this.kelurahanRepo.createQueryBuilder('kl')
      .leftJoinAndSelect('kl.kecamatan', 'kc')
      .leftJoinAndSelect('kc.kabupaten', 'kb')
      .leftJoinAndSelect('kb.provinsi', 'pv')
      .where('UPPER(kl.nama) LIKE :search OR UPPER(kc.nama) LIKE :search OR UPPER(kb.nama) LIKE :search', {
        search: `%${search.toUpperCase()}%`
      })
      .orderBy('kl.nama', 'ASC')
      .take(limit)
      .getMany();

    const result = items.map(item => ({
      id: item.id,
      kelurahan: item.nama,
      kecamatan: item.kecamatan?.nama || '',
      kabupaten: item.kecamatan?.kabupaten?.nama || '',
      provinsi: item.kecamatan?.kabupaten?.provinsi?.nama || '',
      kodePos: item.kodePos || '',
      label: `${item.nama}, ${item.kecamatan?.nama || ''}, ${item.kecamatan?.kabupaten?.nama || ''}, ${item.kecamatan?.kabupaten?.provinsi?.nama || ''}`
    }));

    await this.redis.set(cacheKey, JSON.stringify(result), 'EX', this.CACHE_TTL);
    return result;
  }
}
