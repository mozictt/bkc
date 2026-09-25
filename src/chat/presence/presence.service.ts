import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

/**
 * PresenceService — mengelola status online/offline user menggunakan Redis.
 *
 * Strategi:
 * - Saat user connect WebSocket: set key dengan TTL 35 detik
 * - Client harus mengirim heartbeat setiap 30 detik untuk memperbarui TTL
 * - Saat user disconnect: hapus key secara eksplisit
 * - Key format: presence:{tenantId}:{userId}
 */
@Injectable()
export class PresenceService {
  private readonly PRESENCE_TTL = 35; // detik

  constructor(@InjectRedis() private readonly redis: Redis) {}

  private buildKey(tenantId: string, userId: number): string {
    return `presence:${tenantId}:${userId}`;
  }

  /** Tandai user sebagai online. Dipanggil saat WebSocket connect. */
  async setOnline(tenantId: string, userId: number, socketId: string): Promise<void> {
    const key = this.buildKey(tenantId, userId);
    await this.redis.setex(key, this.PRESENCE_TTL, socketId);
  }

  /** Hapus status online user. Dipanggil saat WebSocket disconnect. */
  async setOffline(tenantId: string, userId: number): Promise<void> {
    const key = this.buildKey(tenantId, userId);
    await this.redis.del(key);
  }

  /** Perbarui TTL tanpa mengubah nilai (heartbeat dari client). */
  async refreshPresence(tenantId: string, userId: number): Promise<void> {
    const key = this.buildKey(tenantId, userId);
    await this.redis.expire(key, this.PRESENCE_TTL);
  }

  /** Cek apakah user sedang online. */
  async isOnline(tenantId: string, userId: number): Promise<boolean> {
    const key = this.buildKey(tenantId, userId);
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /** Ambil daftar userID yang sedang online dalam satu tenant. */
  async getOnlineUsers(tenantId: string): Promise<number[]> {
    const pattern = `presence:${tenantId}:*`;
    const keys = await this.redis.keys(pattern);
    return keys.map((key) => Number(key.split(':')[2]));
  }
}
