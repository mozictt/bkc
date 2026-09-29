import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { QueryNotificationDto } from './dto/query-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  /**
   * Ambil riwayat notifikasi untuk user tertentu (dengan pagination & filter unread).
   */
  async getUserNotifications(userId: number, query: QueryNotificationDto) {
    const { unreadOnly, type, page = 1, limit = 20 } = query;
    const targetUserId = Number(userId);

    const qb = this.notificationRepo
      .createQueryBuilder('n')
      .where('n.userId = :userId', { userId: targetUserId })
      .orderBy('n.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (unreadOnly) {
      qb.andWhere('n.isRead = :isRead', { isRead: false });
    }

    if (type) {
      qb.andWhere('n.type = :type', { type });
    }

    const [items, total] = await qb.getManyAndCount();
    const unreadCount = await this.getUnreadCount(userId);

    return {
      items,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Hitung jumlah notifikasi yang belum dibaca (Unread Count)
   */
  async getUnreadCount(userId: number): Promise<number> {
    return this.notificationRepo.count({
      where: { userId: Number(userId), isRead: false },
    });
  }

  /**
   * Tandai satu notifikasi spesifik sebagai sudah dibaca (Read)
   */
  async markAsRead(id: string, userId: number): Promise<Notification> {
    const notif = await this.notificationRepo.findOne({
      where: { id, userId: Number(userId) },
    });

    if (!notif) {
      throw new NotFoundException('Notifikasi tidak ditemukan');
    }

    if (!notif.isRead) {
      notif.isRead = true;
      notif.readAt = new Date();
      await this.notificationRepo.save(notif);
    }

    return notif;
  }

  /**
   * Tandai semua notifikasi milik user sebagai sudah dibaca (Read All)
   */
  async markAllAsRead(userId: number): Promise<{ affected: number }> {
    const result = await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true, readAt: new Date() })
      .where('userId = :userId AND isRead = false', { userId: Number(userId) })
      .execute();

    return { affected: result.affected || 0 };
  }

  /**
   * Buat notifikasi baru di database
   */
  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    const notif = this.notificationRepo.create({
      userId: dto.userId,
      tenantId: dto.tenantId ?? null,
      type: dto.type,
      title: dto.title,
      body: dto.body,
      actionUrl: dto.actionUrl ?? null,
      payload: dto.payload ?? null,
      isRead: false,
    });

    return this.notificationRepo.save(notif);
  }
}
