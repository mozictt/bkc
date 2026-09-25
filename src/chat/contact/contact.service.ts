import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatContact } from '../entities/chat-contact.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { BaseTenantService } from '../../common/tenant/base-tenant.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { User } from '@entities/user.entity';

@Injectable()
export class ContactService extends BaseTenantService<ChatContact> {
  constructor(
    @InjectRepository(ChatContact)
    private readonly contactRepo: Repository<ChatContact>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    tenantService: TenantContextService,
  ) {
    super(contactRepo, tenantService, 'contact');
  }

  /**
   * Ambil semua kontak milik user yang sedang login.
   * Eager-load data contactUser (pegawai) untuk menampilkan nama & avatar.
   */
  async findAll(): Promise<ChatContact[]> {
    const ownerId = Number(this.tenantService.getUserId());
    return this.contactRepo
      .createQueryBuilder('contact')
      .leftJoinAndSelect('contact.contactUser', 'cu')
      .leftJoinAndSelect('cu.pegawai', 'pegawai')
      .where('contact.tenantId = :tenantId', { tenantId: this.tenantId })
      .andWhere('contact.ownerId = :ownerId', { ownerId })
      .andWhere('contact.deletedAt IS NULL')
      .orderBy('pegawai.name', 'ASC')
      .getMany();
  }

  /**
   * Cari user lain berdasarkan username atau nama pegawai untuk ditambah sebagai kontak.
   * Mengecualikan diri sendiri dari hasil pencarian.
   */
  async searchUsers(query: string): Promise<User[]> {
    const currentUserId = Number(this.tenantService.getUserId());
    return this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.pegawai', 'pegawai')
      .where('u.tenantId = :tenantId', { tenantId: this.tenantId })
      .andWhere('u.id != :currentUserId', { currentUserId })
      .andWhere('u.is_active = true')
      .andWhere(
        '(UPPER(u.username) LIKE :q OR UPPER(pegawai.name) LIKE :q)',
        { q: `%${query.toUpperCase()}%` },
      )
      .andWhere('u.deletedAt IS NULL')
      .take(20)
      .getMany();
  }

  /**
   * Tambah kontak baru.
   * Validasi: tidak bisa menambah diri sendiri dan tidak bisa duplikat.
   */
  async create(dto: CreateContactDto): Promise<ChatContact> {
    const ownerId = Number(this.tenantService.getUserId());

    if (dto.contactUserId === ownerId) {
      throw new BadRequestException('Tidak bisa menambahkan diri sendiri sebagai kontak');
    }

    // Pastikan target user ada di tenant yang sama
    const targetUser = await this.userRepo.findOne({
      where: { id: dto.contactUserId, tenantId: this.tenantId },
    });
    if (!targetUser) {
      throw new NotFoundException('User target tidak ditemukan');
    }

    // Cek duplikasi (termasuk yang sudah soft-deleted)
    const existing = await this.contactRepo.findOne({
      where: {
        tenantId: this.tenantId,
        ownerId,
        contactUserId: dto.contactUserId,
      },
      withDeleted: true,
    });
    if (existing && !existing.deletedAt) {
      throw new ConflictException('Kontak sudah ada dalam daftar kontak Anda');
    }

    // Restore jika sebelumnya dihapus (soft-delete)
    if (existing?.deletedAt) {
      await this.contactRepo.restore(existing.id);
      return this.contactRepo.findOne({ where: { id: existing.id } });
    }

    const contact = this.contactRepo.create({
      tenantId: this.tenantId,
      ownerId,
      contactUserId: dto.contactUserId,
      nickname: dto.nickname ?? null,
    });
    return this.contactRepo.save(contact);
  }

  /**
   * Update nickname atau status blokir kontak.
   * Validasi kepemilikan kontak.
   */
  async update(id: number, dto: UpdateContactDto): Promise<ChatContact> {
    const ownerId = Number(this.tenantService.getUserId());
    const contact = await this.contactRepo.findOne({
      where: { id, tenantId: this.tenantId, ownerId },
    });
    if (!contact) throw new NotFoundException('Kontak tidak ditemukan');

    if (dto.nickname !== undefined) contact.nickname = dto.nickname;
    if (dto.isBlocked !== undefined) contact.isBlocked = dto.isBlocked;

    return this.contactRepo.save(contact);
  }

  /**
   * Hapus kontak (soft-delete).
   * Hanya pemilik kontak yang bisa menghapus.
   */
  async remove(id: number): Promise<void> {
    const ownerId = Number(this.tenantService.getUserId());
    const contact = await this.contactRepo.findOne({
      where: { id, tenantId: this.tenantId, ownerId },
    });
    if (!contact) throw new NotFoundException('Kontak tidak ditemukan');
    await this.contactRepo.softDelete(id);
  }
}
