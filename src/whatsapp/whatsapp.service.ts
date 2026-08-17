import { Injectable, OnApplicationBootstrap, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as path from 'path';
import * as fs from 'fs';
import pino from 'pino';
import { WhatsappDevice } from './entities/whatsapp-device.entity';
import { WhatsappLog } from './entities/whatsapp-log.entity';
import { TenantContextService } from '../common/tenant/tenant-context.service';

@Injectable()
export class WhatsappService implements OnApplicationBootstrap {
  private activeSockets = new Map<string, WASocket>();
  private qrCodes = new Map<string, string>(); // Menyimpan QR Code terbaru per device
  private readonly sessionBaseDir = path.join(process.cwd(), 'storage', 'whatsapp-sessions');

  constructor(
    @InjectRepository(WhatsappDevice)
    private readonly deviceRepo: Repository<WhatsappDevice>,
    @InjectRepository(WhatsappLog)
    private readonly logRepo: Repository<WhatsappLog>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async onApplicationBootstrap() {
    if (!fs.existsSync(this.sessionBaseDir)) {
      fs.mkdirSync(this.sessionBaseDir, { recursive: true });
    }

    // Auto-reconnect seluruh device yang terdaftar di database
    try {
      const devices = await this.deviceRepo.find();
      for (const device of devices) {
        console.log(`[WhatsApp] Auto-reconnecting WhatsApp Device ID: ${device.id} (Tenant: ${device.tenantId})`);
        this.initSession(device.id).catch((err) => {
          console.error(`[WhatsApp] Gagal auto-reconnect WhatsApp device ${device.id}:`, err);
        });
      }
    } catch (err) {
      console.error(`[WhatsApp] Gagal memuat data perangkat saat startup:`, err);
    }
  }

  /**
   * Menginisialisasi koneksi WhatsApp Link untuk Device ID tertentu
   */
  async initSession(deviceId: string): Promise<void> {
    let tenantId = this.tenantContext.getTenantId();

    // Jika dipanggil saat startup (di luar HTTP request context), cari tenantId dari database
    if (!tenantId) {
      const device = await this.deviceRepo.findOneBy({ id: deviceId });
      if (device) {
        tenantId = device.tenantId;
      }
    }

    if (!tenantId) {
      throw new BadRequestException(`Tenant ID tidak ditemukan untuk perangkat ${deviceId}.`);
    }

    // Validasi kepemilikan perangkat agar Tenant A tidak membajak Device ID Tenant B
    const existingDevice = await this.deviceRepo.findOneBy({ id: deviceId });
    if (existingDevice) {
      if (existingDevice.tenantId !== tenantId) {
        const userRole = this.tenantContext.getRole();
        if (userRole !== 'Super Admin') {
          throw new BadRequestException(`Perangkat ${deviceId} dimiliki oleh tenant lain!`);
        }
      }
    } else {
      // Daftarkan perangkat baru ke database
      const newDevice = this.deviceRepo.create({
        id: deviceId,
        tenantId,
        status: 'connecting',
      });
      await this.deviceRepo.save(newDevice);
    }

    const sessionPath = path.join(this.sessionBaseDir, deviceId);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const silentLogger: any = pino({ level: 'silent' });

    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: silentLogger,
      browser: ['NestJS Backend', 'Chrome', '1.0.0'],
    });

    this.activeSockets.set(deviceId, sock);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.qrCodes.set(deviceId, qr);
      }

      if (connection === 'close') {
        this.qrCodes.delete(deviceId);
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;

        console.log(`🔌 WhatsApp Device ${deviceId} terputus. Reconnect: ${shouldReconnect}`);

        if (shouldReconnect) {
          this.initSession(deviceId);
        } else {
          this.activeSockets.delete(deviceId);
          this.deleteSessionFolder(deviceId);
          // Update status di DB
          await this.deviceRepo.update(deviceId, { status: 'disconnected', phoneNumber: null });
        }
      } else if (connection === 'open') {
        this.qrCodes.delete(deviceId);
        const phoneNumber = sock.user?.id?.split(':')[0] || sock.user?.id || null;

        console.log(`✅ WhatsApp Device ${deviceId} BERHASIL TERHUBUNG (${phoneNumber})`);

        // Update status perangkat dan nomor telepon di DB
        await this.deviceRepo.update(deviceId, { status: 'connected', phoneNumber });
      }
    });

    // Menangani pesan masuk
    sock.ev.on('messages.upsert', async (m) => {
      if (m.type === 'notify') {
        for (const msg of m.messages) {
          // Ekstrak konten teks dari berbagai kemungkinan tipe pesan Baileys
          const textContent =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            msg.message?.videoMessage?.caption ||
            '';

          if (!msg.key.fromMe && textContent) {
            const senderNumber = msg.key.remoteJid?.split('@')[0] || msg.key.remoteJid || '';

            console.log(`💬 WhatsApp [Device: ${deviceId}] dari ${senderNumber}: ${textContent}`);

            // Simpan riwayat pesan masuk ke database (IN)
            try {
              const dev = await this.deviceRepo.findOneBy({ id: deviceId });
              if (dev) {
                const logEntry = this.logRepo.create({
                  deviceId,
                  tenantId: dev.tenantId,
                  phoneNumber: senderNumber,
                  message: textContent,
                  direction: 'IN',
                  messageId: msg.key.id || null,
                });
                await this.logRepo.save(logEntry);
              }
            } catch (dbErr) {
              console.error(`[WhatsApp] Gagal mencatat pesan masuk ke DB:`, dbErr);
            }

            // Contoh chatbot interaktif sederhana jika user mengirim pesan "/ping"
            if (textContent.trim().toLowerCase() === '/ping') {
              await this.sendMessage(deviceId, msg.key.remoteJid || senderNumber, 'pong! Koneksi aktif.');
            }
          }
        }
      }
    });
  }

  private deleteSessionFolder(deviceId: string) {
    const sessionPath = path.join(this.sessionBaseDir, deviceId);
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
  }

  getQrCode(deviceId: string): string | null {
    return this.qrCodes.get(deviceId) || null;
  }

  getActiveDevices(): string[] {
    const connectedDevices: string[] = [];
    for (const [deviceId, sock] of this.activeSockets.entries()) {
      if (sock?.user?.id) {
        connectedDevices.push(deviceId);
      }
    }
    return connectedDevices;
  }

  /**
   * Mengirim pesan teks ke nomor tertentu
   */
  async sendMessage(deviceId: string, to: string, text: string) {
    const sock = this.activeSockets.get(deviceId);
    if (!sock) {
      throw new InternalServerErrorException(`Sesi perangkat ${deviceId} belum aktif.`);
    }

    if (!sock.user || !sock.user.id) {
      throw new BadRequestException(`Perangkat ${deviceId} belum terhubung secara penuh. Silakan scan QR code terlebih dahulu.`);
    }

    // Ambil detail perangkat dari DB untuk validasi tenantId
    const device = await this.deviceRepo.findOneBy({ id: deviceId });
    if (!device) {
      throw new InternalServerErrorException(`Data perangkat ${deviceId} tidak ditemukan di database.`);
    }

    // Validasi tenant (kecuali Super Admin)
    const currentTenantId = this.tenantContext.getTenantId();
    const userRole = this.tenantContext.getRole();
    if (userRole !== 'Super Admin' && device.tenantId !== currentTenantId) {
      throw new BadRequestException(`Akses ke perangkat ${deviceId} ditolak (bukan milik tenant Anda).`);
    }

    let formattedJid = to;
    if (!to.includes('@')) {
      formattedJid = `${to.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
    }

    // 1. Skema Pencegahan Blokir: Cek validitas nomor WhatsApp di server WA
    try {
      const [whatsappCheck] = await sock.onWhatsApp(formattedJid);
      if (!whatsappCheck || !whatsappCheck.exists) {
        const errorMsg = `Nomor ${to} tidak terdaftar di WhatsApp.`;
        console.warn(`[WhatsApp] ${errorMsg}`);
        
        // Simpan log kegagalan ke database
        try {
          const logEntry = this.logRepo.create({
            deviceId,
            tenantId: device.tenantId,
            phoneNumber: to.replace(/[^0-9]/g, ''),
            message: `[GAGAL - BUKAN WHATSAPP] ${text}`,
            direction: 'OUT',
            messageId: 'INVALID_NUMBER',
          });
          await this.logRepo.save(logEntry);
        } catch (dbErr) {
          console.error(`[WhatsApp] Gagal mencatat pesan gagal ke DB:`, dbErr);
        }
        
        throw new BadRequestException(errorMsg);
      }
    } catch (checkErr) {
      if (checkErr instanceof BadRequestException) {
        throw checkErr;
      }
      console.warn(`[WhatsApp] Gagal melakukan pengecekan nomor WhatsApp untuk ${formattedJid}:`, checkErr.message);
    }

    // 2. Skema Pencegahan Blokir: Simulasi mengetik dinamis (composing) berdasarkan panjang teks
    try {
      const typingDuration = Math.min(5000, Math.max(1500, text.length * 35)); // Antara 1.5s - 5s
      await sock.sendPresenceUpdate('composing', formattedJid);
      await new Promise((resolve) => setTimeout(resolve, typingDuration));
      await sock.sendPresenceUpdate('paused', formattedJid);
    } catch (presenceError) {
      console.warn(`[WhatsApp] Gagal memperbarui status mengetik untuk ${formattedJid}:`, presenceError);
    }

    const res = await sock.sendMessage(formattedJid, { text });

    // Simpan riwayat pesan keluar ke database (OUT)
    try {
      const logEntry = this.logRepo.create({
        deviceId,
        tenantId: device.tenantId,
        phoneNumber: to.replace(/[^0-9]/g, ''),
        message: text,
        direction: 'OUT',
        messageId: res.key.id || null,
      });
      await this.logRepo.save(logEntry);
    } catch (dbErr) {
      console.error(`[WhatsApp] Gagal mencatat pesan keluar ke DB:`, dbErr);
    }

    return res;
  }

  /**
   * Mengirim broadcast pesan ke banyak nomor secara asinkronus (di background)
   */
  async startBroadcast(deviceId: string, recipients: string[], text: string, delayMs = 3000): Promise<any> {
    const sock = this.activeSockets.get(deviceId);
    if (!sock) {
      throw new BadRequestException(`Sesi perangkat ${deviceId} belum aktif.`);
    }

    if (!sock.user || !sock.user.id) {
      throw new BadRequestException(`Perangkat ${deviceId} belum terhubung. Silakan scan QR code terlebih dahulu.`);
    }

    const device = await this.deviceRepo.findOneBy({ id: deviceId });
    if (!device) {
      throw new BadRequestException(`Data perangkat ${deviceId} tidak ditemukan.`);
    }

    // Validasi tenant (kecuali Super Admin)
    const currentTenantId = this.tenantContext.getTenantId();
    const userRole = this.tenantContext.getRole();
    if (userRole !== 'Super Admin' && device.tenantId !== currentTenantId) {
      throw new BadRequestException(`Akses ke perangkat ${deviceId} ditolak.`);
    }

    // Jalankan pengiriman di background agar tidak memblokir HTTP response
    this.runBroadcastBackground(deviceId, recipients, text, delayMs);

    return {
      success: true,
      message: `Proses broadcast ke ${recipients.length} nomor telah dimulai di latar belakang.`,
      totalRecipients: recipients.length,
    };
  }

  private async runBroadcastBackground(
    deviceId: string,
    recipients: string[],
    text: string,
    delayMs: number,
  ) {
    console.log(`[WhatsApp Broadcast] Memulai pengiriman ke ${recipients.length} nomor untuk Device ${deviceId}...`);

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i].trim();
      if (!recipient) continue;

      try {
        // Gunakan sendMessage yang sudah merekam ke DB dan mensimulasikan typing status
        await this.sendMessage(deviceId, recipient, text);
        console.log(`[WhatsApp Broadcast] [${i + 1}/${recipients.length}] Berhasil mengirim ke ${recipient}`);
      } catch (err) {
        console.error(`[WhatsApp Broadcast] [${i + 1}/${recipients.length}] Gagal mengirim ke ${recipient}:`, err.message);
      }

      // Beri jeda acak antara 0 - 5 menit (anti-ban) sebelum pesan berikutnya
      if (i < recipients.length - 1) {
        const randomizedDelay = Math.floor(Math.random() * 5 * 60 * 1000); // 0 s/d 300.000 ms (5 menit)
        const delayInSeconds = Math.round(randomizedDelay / 1000);
        console.log(`[WhatsApp Broadcast] Jeda acak aktif: Menunggu selama ${delayInSeconds} detik sebelum mengirim ke penerima berikutnya...`);
        await new Promise((resolve) => setTimeout(resolve, randomizedDelay));
      }
    }

    console.log(`[WhatsApp Broadcast] Pengiriman broadcast selesai untuk Device ${deviceId}.`);
  }

  /**
   * Mengambil riwayat log pesan untuk tenant saat ini
   */
  async getMessageLogs(page = 1, limit = 20) {
    const tenantId = this.tenantContext.getTenantId();
    const userRole = this.tenantContext.getRole();

    const qb = this.logRepo.createQueryBuilder('log');

    // Jika bukan Super Admin, filter berdasarkan tenantId
    if (userRole !== 'Super Admin') {
      if (!tenantId) throw new BadRequestException('Context tenant tidak ditemukan.');
      qb.where('log.tenantId = :tenantId', { tenantId });
    }

    const [items, total] = await qb
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: +limit,
        totalPages: Math.ceil(total / limit),
        currentPage: +page,
      },
    };
  }

  /**
   * Mematikan/logout sesi perangkat
   */
  async logoutSession(deviceId: string): Promise<void> {
    const sock = this.activeSockets.get(deviceId);
    if (sock) {
      try {
        await sock.logout();
      } catch (err) {
        console.warn(`[WhatsApp] Logout socket error (mungkin sudah terputus):`, err);
      }
      this.activeSockets.delete(deviceId);
    }
    this.deleteSessionFolder(deviceId);

    // Update status di DB
    await this.deviceRepo.update(deviceId, {
      status: 'disconnected',
      phoneNumber: null,
    });
  }
}
