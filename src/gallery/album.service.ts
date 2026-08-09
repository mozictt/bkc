import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Album } from './entities/album.entity';
import { CreateAlbumDto } from './dto/create-album.dto';
import { TenantContextService } from '@common/tenant/tenant-context.service';

@Injectable()
export class AlbumService {
  constructor(
    @InjectRepository(Album)
    private readonly albumRepo: Repository<Album>,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getTenantFilter() {
    const role = this.tenantContext.getRole();
    if (role === 'Super Admin') return {};
    return { tenantId: this.tenantContext.getTenantId() };
  }

  async create(createAlbumDto: CreateAlbumDto) {
    const existingAlbum = await this.albumRepo.findOne({
      where: {
        name: createAlbumDto.name,
        ...this.getTenantFilter(),
      },
    });

    if (existingAlbum) {
      throw new ConflictException(`Album dengan nama '${createAlbumDto.name}' sudah ada.`);
    }

    const album = this.albumRepo.create(createAlbumDto);
    return this.albumRepo.save(album);
  }

  async findAll() {
    return this.albumRepo.find({
      where: this.getTenantFilter(),
      order: { createdAt: 'DESC' },
      relations: ['galleries'],
    });
  }

  async findOne(id: string) {
    const album = await this.albumRepo.findOne({
      where: { id, ...this.getTenantFilter() },
      relations: ['galleries'],
    });
    if (!album) {
      throw new NotFoundException(`Album dengan ID ${id} tidak ditemukan`);
    }
    return album;
  }

  async update(id: string, updateData: Partial<CreateAlbumDto>) {
    const album = await this.findOne(id);

    if (updateData.name && updateData.name !== album.name) {
      const existingAlbum = await this.albumRepo.findOne({
        where: {
          name: updateData.name,
          ...this.getTenantFilter(),
        },
      });

      if (existingAlbum) {
        throw new ConflictException(`Album dengan nama '${updateData.name}' sudah ada.`);
      }
    }

    this.albumRepo.merge(album, updateData);
    return this.albumRepo.save(album);
  }

  async remove(id: string) {
    const album = await this.findOne(id);
    await this.albumRepo.remove(album);
    return { message: 'Album beserta seluruh media di dalamnya berhasil dihapus' };
  }
}
