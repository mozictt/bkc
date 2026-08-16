import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Album } from './entities/album.entity';
import { CreateAlbumDto } from './dto/create-album.dto';
import { QueryAlbumDto } from './dto/query-album.dto';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { BaseTenantService } from '@common/tenant/base-tenant.service';
import { UploadStorageHelper } from '@common/utils/upload-storage.util';

@Injectable()
export class AlbumService extends BaseTenantService<Album> {
  constructor(
    @InjectRepository(Album)
    private readonly albumRepo: Repository<Album>,
    tenantService: TenantContextService,
  ) {
    super(albumRepo, tenantService, 'album');
  }

  private getTenantFilter() {
    const role = this.tenantService.getRole();
    if (role === 'Super Admin') return {};
    return { tenantId: this.tenantService.getTenantId() };
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

    const album = this.albumRepo.create({
      ...createAlbumDto,
      tenantId: this.tenantService.getTenantId(),
    });
    return this.albumRepo.save(album);
  }

  async findAll(query?: QueryAlbumDto) {
    const page = Math.max(1, query?.page || 1);
    const limit = Math.max(1, query?.limit || 10);
    const search = query?.search?.trim() || '';
    const sortBy = query?.sortBy || 'createdAt';
    const sortType = (query?.sortType || 'desc').toUpperCase() as 'ASC' | 'DESC';

    const qb = this.createQuery()
      .loadRelationCountAndMap('album.mediaCount', 'album.galleries');

    if (search) {
      qb.andWhere(
        '(UPPER(album.name) LIKE :search OR UPPER(album.description) LIKE :search)',
        { search: `%${search.toUpperCase()}%` },
      );
    }

    const allowedSort = ['createdAt', 'name', 'date'];
    const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'createdAt';

    const [data, total] = await qb
      .orderBy(`album.${orderColumn}`, sortType)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      success: true,
      currentPage: page,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
      array: data,
    };
  }

  async findOne(id: string) {
    const album = await this.createQuery()
      .leftJoinAndSelect('album.galleries', 'galleries')
      .andWhere('album.id = :id', { id })
      .getOne();

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

    // Hapus file fisik media yang ada di dalam album ini dari disk via Helper
    if (album.galleries && album.galleries.length > 0) {
      album.galleries.forEach((gallery) => {
        if (gallery.fileName) {
          UploadStorageHelper.removeFile(gallery.fileName, 'gallery');
        }
      });
    }

    await this.albumRepo.remove(album);
    return { message: 'Album beserta seluruh media di dalamnya berhasil dihapus' };
  }
}


