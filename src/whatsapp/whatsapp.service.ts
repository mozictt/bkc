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
        throw new BadRequestException(`Perangkat ${deviceId} dimiliki oleh tenant lain!`);
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
            // Extract sender JID: prioritize real phone number (@s.whatsapp.net) from participant or remoteJid
            let rawSender = msg.key.remoteJid || '';
            if (msg.key.participant && msg.key.participant.includes('@s.whatsapp.net')) {
              rawSender = msg.key.participant;
            } else if (msg.participant && msg.participant.includes('@s.whatsapp.net')) {
              rawSender = msg.participant;
            }

            let senderNumber = '';
            if (rawSender.includes('@s.whatsapp.net')) {
              senderNumber = rawSender.split('@')[0];
            } else if (rawSender.includes('@lid')) {
              // Store full JID for LID addresses so reply functionality can target @lid
              senderNumber = rawSender;
            } else {
              senderNumber = rawSender.split('@')[0] || rawSender;
            }

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
              await this.sendMessage(deviceId, rawSender || senderNumber, 'pong! Koneksi aktif.');
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
   * Mengirim pesan teks dan/atau media (Foto, Video, Dokumen PDF) ke nomor / LID tertentu
   */
  async sendMessage(
    deviceId: string,
    to: string,
    text: string,
    mediaFileOrUrl?: Express.Multer.File | string,
    originalFileName?: string,
  ) {
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

    const formattedJid = this.formatToWhatsappJid(to);
    if (!formattedJid) {
      throw new BadRequestException('Nomor WhatsApp tujuan tidak boleh kosong.');
    }

    // 1. Skema Pencegahan Blokir: Cek validitas nomor WhatsApp HANYA untuk @s.whatsapp.net
    if (formattedJid.endsWith('@s.whatsapp.net')) {
      try {
        // Race onWhatsApp dengan timeout 5 detik agar tidak menggantung (infinite loop/spin)
        const checkPromise = sock.onWhatsApp(formattedJid);
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
        const results = await Promise.race([checkPromise, timeoutPromise]);

        if (results && Array.isArray(results) && results.length > 0) {
          const [whatsappCheck] = results;
          if (!whatsappCheck || !whatsappCheck.exists) {
            const errorMsg = `Nomor ${to} (${formattedJid.split('@')[0]}) tidak terdaftar di WhatsApp.`;
            console.warn(`[WhatsApp] ${errorMsg}`);
            
            // Simpan log kegagalan ke database
            try {
              const logEntry = this.logRepo.create({
                deviceId,
                tenantId: device.tenantId,
                phoneNumber: formattedJid.split('@')[0],
                message: `[GAGAL - BUKAN WHATSAPP] ${text || ''}`,
                direction: 'OUT',
                messageId: 'INVALID_NUMBER',
              });
              await this.logRepo.save(logEntry);
            } catch (dbErr) {
              console.error(`[WhatsApp] Gagal mencatat pesan gagal ke DB:`, dbErr);
            }
            
            throw new BadRequestException(errorMsg);
          }
        }
      } catch (checkErr) {
        if (checkErr instanceof BadRequestException) {
          throw checkErr;
        }
        console.warn(`[WhatsApp] Pengecekan nomor WhatsApp untuk ${formattedJid} mengalami timeout/gagal:`, checkErr.message);
      }
    }

    // 2. Skema Pencegahan Blokir: Simulasi mengetik dinamis (composing) berdasarkan panjang teks
    try {
      const typingDuration = Math.min(5000, Math.max(1500, (text || '').length * 35)); // Antara 1.5s - 5s
      await sock.sendPresenceUpdate('composing', formattedJid);
      await new Promise((resolve) => setTimeout(resolve, typingDuration));
      await sock.sendPresenceUpdate('paused', formattedJid);
    } catch (presenceError) {
      console.warn(`[WhatsApp] Gagal memperbarui status mengetik untuk ${formattedJid}:`, presenceError);
    }

    // 3. Konstruksi Payload Pesan (Teks Biasa vs Media)
    let payload: any = { text: text || '' };
    let mediaTypeLabel = '';

    if (mediaFileOrUrl) {
      let mediaContent: any;
      let mimeType = '';
      let fileName = originalFileName || 'document.pdf';

      if (typeof mediaFileOrUrl === 'string') {
        mediaContent = { url: mediaFileOrUrl };
        if (mediaFileOrUrl.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (mediaFileOrUrl.match(/\.(png|jpg|jpeg|webp|gif)$/i)) mimeType = 'image/jpeg';
        else if (mediaFileOrUrl.match(/\.(mp4|mkv|avi|mov)$/i)) mimeType = 'video/mp4';
      } else {
        mediaContent = mediaFileOrUrl.buffer ? mediaFileOrUrl.buffer : { url: mediaFileOrUrl.path };
        mimeType = mediaFileOrUrl.mimetype;
        fileName = mediaFileOrUrl.originalname;
      }

      if (mimeType.startsWith('image/')) {
        payload = { image: mediaContent, caption: text || '' };
        mediaTypeLabel = 'FOTO';
      } else if (mimeType.startsWith('video/')) {
        payload = { video: mediaContent, caption: text || '', mimetype: mimeType };
        mediaTypeLabel = 'VIDEO';
      } else {
        payload = {
          document: mediaContent,
          caption: text || '',
          fileName: fileName,
          mimetype: mimeType || 'application/pdf',
        };
        mediaTypeLabel = 'DOKUMEN_PDF';
      }
    }

    const res = await sock.sendMessage(formattedJid, payload);

    // Simpan riwayat pesan keluar ke database (OUT)
    try {
      const logEntry = this.logRepo.create({
        deviceId,
        tenantId: device.tenantId,
        phoneNumber: formattedJid.endsWith('@s.whatsapp.net') ? formattedJid.split('@')[0] : formattedJid,
        message: mediaTypeLabel ? `[${mediaTypeLabel}] ${text || ''}` : text,
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
   * Mengirim broadcast pesan (Teks dan/atau Media) ke banyak nomor secara asinkronus (di background)
   */
  async startBroadcast(
    deviceId: string,
    recipients: string[],
    text: string,
    mediaFileOrUrl?: Express.Multer.File | string,
  ): Promise<any> {
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

    let storedMediaPath: string | undefined = undefined;
    let originalFileName: string | undefined = undefined;

    // Jika file dikirimkan pada broadcast, simpan sementara ke disk agar tidak hilang di background task
    if (mediaFileOrUrl && typeof mediaFileOrUrl !== 'string') {
      const uploadFolder = path.join(process.cwd(), 'storage', 'uploads', 'whatsapp-media');
      if (!fs.existsSync(uploadFolder)) {
        fs.mkdirSync(uploadFolder, { recursive: true });
      }
      const uniqueFileName = `${Date.now()}-${mediaFileOrUrl.originalname}`;
      storedMediaPath = path.join(uploadFolder, uniqueFileName);
      fs.writeFileSync(storedMediaPath, mediaFileOrUrl.buffer);
      originalFileName = mediaFileOrUrl.originalname;
    } else if (typeof mediaFileOrUrl === 'string') {
      storedMediaPath = mediaFileOrUrl;
    }

    // Jalankan pengiriman di background agar tidak memblokir HTTP response
    this.runBroadcastBackground(deviceId, recipients, text, storedMediaPath, originalFileName);

    return {
      success: true,
      message: `Proses broadcast ${storedMediaPath ? 'Media' : 'Teks'} ke ${recipients.length} nomor telah dimulai di latar belakang.`,
      totalRecipients: recipients.length,
    };
  }

  private async runBroadcastBackground(
    deviceId: string,
    recipients: string[],
    text: string,
    mediaPath?: string,
    originalFileName?: string,
  ) {
    console.log(`[WhatsApp Broadcast] Memulai pengiriman (${mediaPath ? 'MEDIA' : 'TEKS'}) ke ${recipients.length} nomor untuk Device ${deviceId}...`);

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i].trim();
      if (!recipient) continue;

      try {
        await this.sendMessage(deviceId, recipient, text, mediaPath, originalFileName);
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
   * dengan dukungan filter: direction, search nomor/pesan, deviceId
   */
  async getMessageLogs(
    page = 1,
    limit = 20,
    direction?: 'IN' | 'OUT',
    search?: string,
    deviceId?: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const userRole = this.tenantContext.getRole();

    const qb = this.logRepo.createQueryBuilder('log');

    // Filter berdasarkan tenant (kecuali Super Admin)
    if (userRole !== 'Super Admin') {
      if (!tenantId) throw new BadRequestException('Context tenant tidak ditemukan.');
      qb.where('log.tenantId = :tenantId', { tenantId });
    }

    // Filter opsional: arah pesan (IN / OUT)
    if (direction) {
      qb.andWhere('log.direction = :direction', { direction });
    }

    // Filter opsional: pencarian nomor telepon atau isi pesan
    if (search && search.trim()) {
      qb.andWhere(
        '(log.phoneNumber ILIKE :search OR log.message ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    // Filter opsional: deviceId tertentu
    if (deviceId && deviceId.trim()) {
      qb.andWhere('log.deviceId = :deviceId', { deviceId: deviceId.trim() });
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

  /**
   * Mengubah input nomor telepon ke format JID WhatsApp yang valid.
   * Contoh: '08123456789' -> '628123456789@s.whatsapp.net'
   * Contoh: '+62 812-3456-789' -> '628123456789@s.whatsapp.net'
   * Contoh: '12345678@lid' -> '12345678@lid'
   */
  private formatToWhatsappJid(to: string): string {
    const cleanTo = (to || '').trim();
    if (!cleanTo) return '';

    if (cleanTo.includes('@')) {
      return cleanTo;
    }

    if (cleanTo.endsWith('lid')) {
      return `${cleanTo}@lid`;
    }

    // Hapus semua karakter non-angka
    let digits = cleanTo.replace(/[^0-9]/g, '');

    // Konversi nomor Indonesia yang diawali '0' menjadi '62'
    if (digits.startsWith('0')) {
      digits = '62' + digits.slice(1);
    }

    return `${digits}@s.whatsapp.net`;
  }
}
