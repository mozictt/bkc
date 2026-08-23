import { Injectable, OnApplicationBootstrap, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  downloadMediaMessage,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as path from 'path';
import * as fs from 'fs';
import pino from 'pino';
import { WhatsappDevice } from './entities/whatsapp-device.entity';
import { WhatsappLog } from './entities/whatsapp-log.entity';
import { WhatsappContact } from './entities/whatsapp-contact.entity';
import { Tenant } from '../entities/tenant.entity';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { UploadStorageHelper } from '../common/utils/upload-storage.util';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { WhatsappGateway } from './whatsapp.gateway';

@Injectable()
export class WhatsappService implements OnApplicationBootstrap {
  private activeSockets = new Map<string, WASocket>();
  private qrCodes = new Map<string, string>(); // Menyimpan QR Code terbaru per device
  private readonly sessionBaseDir = path.join(process.cwd(), 'storage', 'whatsapp-sessions');
  private tenantSlugCache = new Map<string, string>();

  constructor(
    @InjectRepository(WhatsappDevice)
    private readonly deviceRepo: Repository<WhatsappDevice>,
    @InjectRepository(WhatsappLog)
    private readonly logRepo: Repository<WhatsappLog>,
    @InjectRepository(WhatsappContact)
    private readonly contactRepo: Repository<WhatsappContact>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly tenantContext: TenantContextService,
    @InjectRedis() private readonly redis: Redis,
    private readonly wsGateway: WhatsappGateway,
  ) {}

  /**
   * Resolusi slug tenant terpusat menggunakan UploadStorageHelper global.
   */
  async getTenantSlug(tenantId: string): Promise<string> {
    return UploadStorageHelper.resolveSlug(this.tenantRepo, tenantId, this.tenantContext);
  }

  /**
   * Helper terpusat untuk menyimpan media (gambar, video, dokumen) dari WhatsApp.
   * Menghindari duplikasi kode (DRY Principle) antar proses sync dan live message.
   */
  private async saveWhatsAppMedia(buffer: Buffer, mime: string, tenantId: string, prefix = 'wa-media', originalFileName?: string): Promise<string> {
    const isMedia = mime.startsWith('image/') || mime.startsWith('video/');
    const ext = mime.split('/')[1]?.split(';')[0] || (isMedia ? 'jpg' : 'pdf');
    
    let baseName = prefix;
    let finalExt = ext;

    if (originalFileName) {
      const lastDot = originalFileName.lastIndexOf('.');
      if (lastDot !== -1) {
        baseName = originalFileName.substring(0, lastDot).replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').toLowerCase();
        finalExt = originalFileName.substring(lastDot + 1).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || ext;
      } else {
        baseName = originalFileName.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').toLowerCase();
      }
    }
    
    baseName = baseName.replace(/-+$/, '').substring(0, 50) || prefix;
    const fileName = `${baseName}-${Date.now()}-${Math.floor(Math.random() * 1000)}.${finalExt}`;
    
    const tenantSlug = await this.getTenantSlug(tenantId);
    const { absoluteFolder, relativeFolder } = UploadStorageHelper.getUploadPath(
      tenantSlug,
      'whatsapp',
      'media'
    );
    
    UploadStorageHelper.ensureDirectoryExists(absoluteFolder);
    const filePath = path.join(absoluteFolder, fileName);
    fs.writeFileSync(filePath, buffer);
    
    const relativeStoredPath = path.join(relativeFolder, fileName).replace(/\\/g, '/');
    return `/whatsapp/media/${relativeStoredPath}`;
  }

  async onApplicationBootstrap() {
    if (!fs.existsSync(this.sessionBaseDir)) {
      fs.mkdirSync(this.sessionBaseDir, { recursive: true });
    }

    const uploadsBaseDir = path.join(process.cwd(), 'storage', 'uploads');
    if (!fs.existsSync(uploadsBaseDir)) {
      fs.mkdirSync(uploadsBaseDir, { recursive: true });
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

      // Auto-cleanup perbaikan chatType log lama jika ber-JID grup
      try {
        await this.logRepo
          .createQueryBuilder()
          .update(WhatsappLog)
          .set({ chatType: 'GROUP' })
          .where("phoneNumber LIKE '%@g.us' AND (chatType IS NULL OR chatType = 'PERSONAL')")
          .execute();
      } catch (e) {
        // ignore
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
        tenantId = device.tenantId || undefined;
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

    // Auto-sync kontak dari WhatsApp ke Database Master Kontak
    sock.ev.on('contacts.upsert', async (contacts) => {
      for (const c of contacts) {
        if (!c.id || !c.id.includes('@s.whatsapp.net')) continue;
        const phoneNumber = c.id.split('@')[0];
        try {
          let contact = await this.contactRepo.findOneBy({ tenantId, jid: c.id });
          if (!contact) {
            contact = this.contactRepo.create({
              tenantId,
              jid: c.id,
              phoneNumber,
              name: c.name || c.notify || null,
              pushName: c.notify || null,
            } as any) as unknown as WhatsappContact;
          } else {
            if (c.name) contact.name = c.name;
            if (c.notify) contact.pushName = c.notify;
          }
          await this.contactRepo.save(contact);
        } catch (e) {
          // ignore race condition
        }
      }
    });

    // Sinkronisasi riwayat awal dari WhatsApp (Chat, Kontak, dan Pesan Historis)
    sock.ev.on('messaging-history.set', async ({ chats, contacts, messages, isLatest }) => {
      console.log(`[WhatsApp] Menerima event sinkronisasi riwayat (${chats.length} chat, ${contacts.length} kontak, ${messages.length} pesan). isLatest: ${isLatest}`);

      // 1. Sinkronisasi Kontak secara asinkron di background untuk efisiensi
      setImmediate(async () => {
        try {
          for (const c of contacts) {
            if (!c.id || !c.id.includes('@s.whatsapp.net')) continue;
            const phoneNumber = c.id.split('@')[0];
            let contact = await this.contactRepo.findOneBy({ tenantId, jid: c.id });
            if (!contact) {
              contact = this.contactRepo.create({
                tenantId,
                jid: c.id,
                phoneNumber,
                name: c.name || c.notify || null,
                pushName: c.notify || null,
              } as any) as unknown as WhatsappContact;
            } else {
              if (c.name) contact.name = c.name;
              if (c.notify) contact.pushName = c.notify;
            }
            await this.contactRepo.save(contact);
          }
          console.log(`[WhatsApp] Berhasil mensinkronisasi ${contacts.length} kontak historis.`);
        } catch (e) {
          console.error('[WhatsApp] Error sync kontak historis:', e.message);
        }
      });

      // 2. Sinkronisasi Chat & Pesan Historis (Termasuk pemrosesan media/dokumen)
      setImmediate(async () => {
        try {
          let syncedCount = 0;
          for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;
            
            const imageMsg = msg.message?.imageMessage;
            const videoMsg = msg.message?.videoMessage;
            const docMsg = msg.message?.documentMessage;
            const audioMsg = msg.message?.audioMessage;
            const stickerMsg = msg.message?.stickerMessage;

            let textContent = msg.message?.conversation || msg.message?.extendedTextMessage?.text || imageMsg?.caption || videoMsg?.caption || docMsg?.caption || '';

            if (!textContent) {
              if (imageMsg) textContent = '[Gambar]';
              else if (videoMsg) textContent = '[Video]';
              else if (docMsg) textContent = '[Dokumen]';
              else if (audioMsg) textContent = '[Audio]';
              else if (stickerMsg) textContent = '[Sticker]';
            }

            if (!textContent && !imageMsg && !videoMsg && !docMsg) continue;

            const remoteJid = msg.key.remoteJid || '';
            const isGroup = remoteJid.endsWith('@g.us');
            const senderPhone = remoteJid.split('@')[0];
            
            const msgId = msg.key.id;
            if (!msgId) continue;

            const existing = await this.logRepo.findOneBy({ messageId: msgId, deviceId });
            if (!existing) {
              // Unduh media secara asinkron untuk pesan historis
              let mediaUrl: string | null = null;
              if (imageMsg || videoMsg || docMsg) {
                try {
                  const buffer = await downloadMediaMessage(
                    msg,
                    'buffer',
                    {},
                    {
                      logger: pino({ level: 'silent' }) as any,
                      reuploadRequest: sock.updateMediaMessage,
                    }
                  );
                  if (buffer) {
                    const mime = imageMsg?.mimetype || videoMsg?.mimetype || docMsg?.mimetype || 'image/jpeg';
                    const originalName = docMsg?.fileName || docMsg?.title || undefined;
                    mediaUrl = await this.saveWhatsAppMedia(buffer, mime, tenantId as string, 'wa-history', originalName);
                  }
                } catch (mediaErr) {
                  console.warn(`[WhatsApp] Gagal mengunduh media dari pesan history ${msgId}:`, mediaErr.message);
                }
              }

              const logEntry = this.logRepo.create({
                deviceId,
                tenantId,
                phoneNumber: isGroup ? remoteJid : senderPhone,
                message: textContent,
                mediaUrl,
                direction: 'IN',
                messageId: msgId,
                chatType: isGroup ? 'GROUP' : 'PERSONAL',
              });
              await this.logRepo.save(logEntry);
              syncedCount++;
            }
          }
          console.log(`[WhatsApp] Berhasil mensinkronisasi ${syncedCount} pesan historis (termasuk media).`);
        } catch (e) {
          console.error('[WhatsApp] Error sync pesan historis:', e.message);
        }
      });
    });

    let isNewLogin = false;

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Jika sistem menghasilkan QR, berarti ini adalah sesi login baru (fresh start)
        isNewLogin = true;
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

        // Jika ini adalah login baru (hasil scan QR), reset otomatis data historis beserta file medianya
        if (isNewLogin) {
          try {
            await this.logRepo.delete({ tenantId });
            await this.contactRepo.delete({ tenantId });

            // Hapus file media secara fisik dari storage
            const tenantSlug = await this.getTenantSlug(tenantId as string);
            const { absoluteFolder: galleryFolder } = UploadStorageHelper.getUploadPath(tenantSlug, 'gallery', 'whatsapp-media');
            const { absoluteFolder: docFolder } = UploadStorageHelper.getUploadPath(tenantSlug, 'documents', 'whatsapp-media');
            
            if (fs.existsSync(galleryFolder)) fs.rmSync(galleryFolder, { recursive: true, force: true });
            if (fs.existsSync(docFolder)) fs.rmSync(docFolder, { recursive: true, force: true });

            console.log(`[WhatsApp] Data riwayat, kontak, dan file media otomatis direset karena Login QR baru.`);
          } catch (err) {
            console.error(`[WhatsApp] Gagal auto-reset data setelah login:`, err);
          }
          isNewLogin = false;
        }

        // Update status perangkat dan nomor telepon di DB
        await this.deviceRepo.update(deviceId, { status: 'connected', phoneNumber });
      }
    });

    // Menangani pesan masuk & keluar (sync percakapan)
    sock.ev.on('messages.upsert', async (m) => {
      if (m.type === 'notify' || m.type === 'append') {
        for (const msg of m.messages) {
          const imageMsg = msg.message?.imageMessage;
          const videoMsg = msg.message?.videoMessage;
          const docMsg = msg.message?.documentMessage;
          const audioMsg = msg.message?.audioMessage;
          const stickerMsg = msg.message?.stickerMessage;

          // Ekstrak konten teks dari berbagai kemungkinan tipe pesan Baileys
          let textContent =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            imageMsg?.caption ||
            videoMsg?.caption ||
            docMsg?.caption ||
            '';

          if (!textContent) {
            if (imageMsg) textContent = '[Gambar]';
            else if (videoMsg) textContent = '[Video]';
            else if (docMsg) textContent = '[Dokumen]';
            else if (audioMsg) textContent = '[Audio]';
            else if (stickerMsg) textContent = '[Sticker]';
          }

          if (!textContent && !imageMsg && !videoMsg && !docMsg) continue;

          // Ekstrak ID pesan yang dikutip (jika pesan ini merupakan balasan/reply)
          const contextInfo = msg.message?.extendedTextMessage?.contextInfo || imageMsg?.contextInfo || videoMsg?.contextInfo || docMsg?.contextInfo;
          const incomingQuotedMsgId: string | null = contextInfo?.stanzaId || null;

          const dev = await this.deviceRepo.findOneBy({ id: deviceId });
          if (!dev) continue;

          // Extract sender/recipient JID & Standarisasi Nomor Telepon
          const remoteJid = msg.key.remoteJid || '';
          if (remoteJid.includes('@lid') || remoteJid.startsWith('1415')) {
            console.log('--- LID MESSAGE PAYLOAD ---', JSON.stringify(msg, null, 2));
          }
          
          let senderJid = remoteJid;
          
          if (!msg.key.fromMe) {
            const myPhoneNum = sock.user?.id ? sock.user.id.split(':')[0].split('@')[0] : '';
            
            // Prioritas 1: Gunakan remoteJidAlt jika tersedia (Baileys menyimpan nomor asli di sini untuk pesan iklan/LID)
            if ((msg.key as any).remoteJidAlt && typeof (msg.key as any).remoteJidAlt === 'string') {
               senderJid = (msg.key as any).remoteJidAlt;
            } else {
               // Prioritas 2: Cek participant (untuk kasus grup atau edge-cases tertentu)
               const participant = msg.key.participant || msg.participant || '';
               const participantNum = participant.split(':')[0].split('@')[0];
               if (participant && participant.includes('@s.whatsapp.net') && participantNum !== myPhoneNum) {
                 senderJid = participant;
               }
            }
          }

          const isGroupMessage = remoteJid.endsWith('@g.us');
          let groupSenderLabel = '';

          if (isGroupMessage) {
            const participantJid = msg.key.participant || msg.participant || '';
            if (participantJid) {
              const senderPhone = participantJid.split('@')[0];
              const pushName = msg.pushName || '';

              let realPhoneNumber = senderPhone;
              let savedName = '';

              try {
                const cleanLidJid = participantJid.includes('@') ? participantJid : `${participantJid}@lid`;
                const linkedContact = await this.findLinkedContactForLid(
                  dev.tenantId as string,
                  cleanLidJid,
                  pushName
                );

                if (linkedContact) {
                  if (linkedContact.name) savedName = linkedContact.name;
                  else if (linkedContact.pushName) savedName = linkedContact.pushName;

                  if (
                    linkedContact.phoneNumber &&
                    !linkedContact.phoneNumber.includes('@lid') &&
                    !linkedContact.phoneNumber.startsWith('1415')
                  ) {
                    realPhoneNumber = linkedContact.phoneNumber;
                  }
                } else {
                  const existingContact = await this.contactRepo.findOneBy({
                    tenantId: dev.tenantId as string,
                    phoneNumber: senderPhone,
                  });
                  if (existingContact?.name) savedName = existingContact.name;
                }
              } catch (e) {
                // ignore
              }

              const displayName = savedName || pushName;
              const isLidNumber = realPhoneNumber.length >= 14 || realPhoneNumber.startsWith('1415');

              if (displayName && isLidNumber) {
                groupSenderLabel = displayName;
              } else if (displayName && !isLidNumber) {
                groupSenderLabel = `${displayName} (${realPhoneNumber})`;
              } else {
                groupSenderLabel = realPhoneNumber;
              }
            }
          }

          // Standarisasi penentuan phoneNum & chatType
          let phoneNum = '';
          if (isGroupMessage) {
            phoneNum = remoteJid;
          } else {
            // Pesan Pribadi: Gunakan senderJid (nomor lawan chat murni)
            const cleanRemote = senderJid.split(':')[0].split('@')[0];
            phoneNum = cleanRemote.replace(/[^0-9]/g, '');
            if (!phoneNum && senderJid.includes('@lid')) {
              phoneNum = senderJid;
            }
          }

          if (!phoneNum || phoneNum.includes('status@broadcast')) continue;

          if (isGroupMessage && !msg.key.fromMe) {
            const fallbackSender = msg.key.participant || msg.participant || '';
            const senderPhoneOnly = fallbackSender ? fallbackSender.split('@')[0] : 'Anggota Grup';
            const finalLabel = groupSenderLabel || senderPhoneOnly;
            textContent = `[${finalLabel}]: ${textContent}`;
          }

          try {
            if (dev) {
              const msgId = msg.key.id || null;
              
              // Cek apakah pesan ini sudah tercatat sebelumnya (cegat duplikasi)
              if (msgId) {
                const existing = await this.logRepo.findOneBy({ messageId: msgId, deviceId });
                if (existing) continue;
              }

              const isFromMe = Boolean(msg.key.fromMe);
              
              // Unduh media jika pesan berupa Gambar, Video, atau Dokumen
              let mediaUrl: string | null = null;
              if (imageMsg || videoMsg || docMsg) {
                try {
                  const buffer = await downloadMediaMessage(
                    msg,
                    'buffer',
                    {},
                    {
                      logger: pino({ level: 'silent' }) as any,
                      reuploadRequest: sock.updateMediaMessage,
                    }
                  );
                  if (buffer) {
                    const mime = imageMsg?.mimetype || videoMsg?.mimetype || docMsg?.mimetype || 'image/jpeg';
                    const originalName = docMsg?.fileName || docMsg?.title || undefined;
                    mediaUrl = await this.saveWhatsAppMedia(buffer, mime, dev.tenantId as string, 'wa-media', originalName);
                  }
                } catch (mediaErr) {
                  console.warn('[WhatsApp] Gagal mengunduh media dari pesan WA:', mediaErr);
                }
              }

              // Tautkan LID (atau nomor LID 15 digit seperti 107593326416118) ke kontak nomor HP yang valid jika ada
              let finalPhoneNum = phoneNum;
              const isLid = remoteJid.includes('@lid') || phoneNum.includes('@lid') || (phoneNum.length >= 14 && (phoneNum.startsWith('107') || phoneNum.startsWith('1415')));
              if (isLid) {
                const cleanLidJid = remoteJid.includes('@') ? remoteJid : `${phoneNum}@lid`;
                const pushName = msg.pushName || undefined;
                const linkedContact = await this.findLinkedContactForLid(dev.tenantId as string, cleanLidJid, pushName);
                if (linkedContact && linkedContact.phoneNumber && !linkedContact.phoneNumber.includes('@lid') && linkedContact.phoneNumber.length < 14) {
                  finalPhoneNum = linkedContact.phoneNumber.replace(/[^0-9]/g, '');
                }
              }

              let realGroupParticipantJid: string | null = null;
              if (isGroupMessage) {
                const rawParticipant = msg.key.participant || msg.participant || '';
                if (rawParticipant && !rawParticipant.includes('120363') && !rawParticipant.endsWith('@g.us')) {
                  realGroupParticipantJid = rawParticipant.split(':')[0];
                }
              }

              const logEntry = this.logRepo.create({
                deviceId,
                tenantId: dev.tenantId,
                phoneNumber: finalPhoneNum,
                message: textContent,
                mediaUrl,
                direction: isFromMe ? 'OUT' : 'IN',
                messageId: msgId,
                participantJid: realGroupParticipantJid,
                quotedMessageId: incomingQuotedMsgId,
                chatType: isGroupMessage ? 'GROUP' : 'PERSONAL',
              });
              await this.logRepo.save(logEntry);

              console.log(
                `💬 WhatsApp [Device: ${deviceId}] [${isFromMe ? 'OUT' : 'IN'}] ${finalPhoneNum} (${phoneNum}): ${textContent}`
              );

              // Otomatis sinkronkan/upsert ke master kontak jika belum ada
              if (!isFromMe) {
                const pushName = msg.pushName || undefined;
                this.upsertContactFromMessage(dev.tenantId as string, senderJid, pushName);
                
                // NOTIFICATION: Tambah hitungan pesan belum dibaca di Redis
                try {
                  const tenantIdStr = dev.tenantId as string;
                  const unreadKey = `wa:unread:tenant:${tenantIdStr}`;
                  const currentUnread = await this.redis.incr(unreadKey);
                  this.wsGateway.emitUnreadUpdate(tenantIdStr, currentUnread);
                } catch (redisErr) {
                  console.warn('[WhatsApp] Gagal memperbarui Redis unread count:', redisErr.message);
                }
              }
            }
          } catch (dbErr) {
            console.error(`[WhatsApp] Gagal mencatat pesan ke DB:`, dbErr);
          }

          // Contoh chatbot interaktif sederhana jika user mengirim pesan "/ping"
          if (!msg.key.fromMe && textContent.trim().toLowerCase() === '/ping') {
            await this.sendMessage(deviceId, senderJid || phoneNum, 'pong! Koneksi aktif.');
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
   * Mengambil daftar semua grup WhatsApp yang diikuti oleh perangkat
   */
  async getGroups(deviceId: string) {
    const sock = this.activeSockets.get(deviceId);
    if (!sock || !sock.user?.id) {
      throw new BadRequestException(`Sesi perangkat ${deviceId} belum aktif.`);
    }

    try {
      const groupsRecord = await sock.groupFetchAllParticipating();
      return Object.values(groupsRecord).map((g) => ({
        id: g.id,
        subject: g.subject,
        owner: g.owner || g.subjectOwner || null,
        creation: g.creation ? new Date(g.creation * 1000) : null,
        desc: g.desc || null,
        participantsCount: g.participants?.length || 0,
        participants: g.participants?.map((p) => ({
          id: p.id,
          phoneNumber: p.id.split('@')[0],
          admin: p.admin || null,
        })),
      }));
    } catch (err: any) {
      console.error(`[WhatsApp] Gagal mengambil daftar grup untuk device ${deviceId}:`, err);
      throw new InternalServerErrorException(err?.message || 'Gagal mengambil daftar grup WhatsApp.');
    }
  }

  /**
   * Mengambil metadata detail grup WhatsApp tertentu berdasarkan ID Grup (@g.us)
   */
  async getGroupMetadata(deviceId: string, groupId: string) {
    const sock = this.activeSockets.get(deviceId);
    if (!sock || !sock.user?.id) {
      throw new BadRequestException(`Sesi perangkat ${deviceId} belum aktif.`);
    }

    const cleanGroupId = groupId.includes('@g.us') ? groupId : `${groupId}@g.us`;
    try {
      const metadata = await sock.groupMetadata(cleanGroupId);
      return {
        id: metadata.id,
        subject: metadata.subject,
        owner: metadata.owner || metadata.subjectOwner || null,
        creation: metadata.creation ? new Date(metadata.creation * 1000) : null,
        desc: metadata.desc || null,
        participantsCount: metadata.participants?.length || 0,
        participants: metadata.participants?.map((p) => ({
          id: p.id,
          phoneNumber: p.id.split('@')[0],
          admin: p.admin || null,
        })),
      };
    } catch (err: any) {
      console.error(`[WhatsApp] Gagal mengambil metadata grup ${cleanGroupId}:`, err);
      throw new InternalServerErrorException(err?.message || 'Gagal mengambil data detail grup WhatsApp.');
    }
  }

  /**
   * Mengirim pesan teks dan/atau media (Foto, Video, Dokumen PDF) ke nomor / LID tertentu
   */
  async sendMessage(
    deviceId: string,
    to: string,
    text: string,
    mediaFileOrUrl?: any,
    originalFileName?: string,
    quotedMessageId?: string,
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
    let finalMediaUrlToSave: string | null = null;

    if (mediaFileOrUrl) {
      let mediaContent: any;
      let mimeType = '';
      let fileName = originalFileName || 'document.pdf';

      if (typeof mediaFileOrUrl === 'string') {
        let normalizedUrl = mediaFileOrUrl;
        
        // Buang origin (e.g., http://localhost:3000) jika ada
        try {
          const urlObj = new URL(normalizedUrl);
          normalizedUrl = urlObj.pathname + urlObj.search;
        } catch (e) {
          // Jika bukan absolute URL, biarkan saja
        }
        
        // Handle frontend Nuxt proxy paths
        if (normalizedUrl.includes('/api/proxy/pos/gallery/')) {
           normalizedUrl = normalizedUrl.replace(/\/api\/proxy\/pos\/gallery\//, '/gallery/media/');
        } else if (normalizedUrl.includes('/api/proxy/pos/documents/')) {
           normalizedUrl = normalizedUrl.replace(/\/api\/proxy\/pos\/documents\//, '/documents/download/');
        } else if (normalizedUrl.includes('/api/proxy/')) {
           // Fallback general proxy
           normalizedUrl = normalizedUrl.replace(/\/api\/proxy\/[^/]+\//, '/');
        }

        const cleanPath = normalizedUrl.replace(/^\/(gallery\/media|documents\/download|whatsapp\/media|uploads)\//, '');
        const resolvedPath = UploadStorageHelper.resolveFileForStreaming(cleanPath, 'gallery', 'documents', 'whatsapp/media');
        const finalUrl = resolvedPath || normalizedUrl;

        mediaContent = { url: finalUrl };
        finalMediaUrlToSave = normalizedUrl; // Simpan path asli backend untuk log
        if (finalUrl.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (finalUrl.match(/\.(png|jpg|jpeg|webp|gif)$/i)) mimeType = 'image/jpeg';
        else if (finalUrl.match(/\.(mp4|mkv|avi|mov)$/i)) mimeType = 'video/mp4';
      } else {
        mediaContent = mediaFileOrUrl.buffer ? mediaFileOrUrl.buffer : { url: mediaFileOrUrl.path };
        mimeType = mediaFileOrUrl.mimetype;
        fileName = mediaFileOrUrl.originalname;
        
        // Simpan file ke storage server untuk history OUT
        if (mediaFileOrUrl.buffer && device.tenantId) {
          finalMediaUrlToSave = await this.saveWhatsAppMedia(mediaFileOrUrl.buffer, mimeType, device.tenantId, 'wa-out', fileName);
        }
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

    const sendOptions: any = {};
    if (quotedMessageId) {
      try {
        let quotedLog = await this.logRepo.findOneBy({ messageId: quotedMessageId, deviceId });
        if (!quotedLog) {
          quotedLog = await this.logRepo.findOneBy({ messageId: quotedMessageId });
        }

        if (quotedLog && quotedLog.messageId) {
          const isGroup = formattedJid.endsWith('@g.us');
          const myPhoneNum = sock.user?.id ? sock.user.id.split(':')[0].split('@')[0] : '';
          const myPhoneJid = myPhoneNum ? `${myPhoneNum}@s.whatsapp.net` : undefined;

          const isQuotedFromMe = quotedLog.direction === 'OUT' || (
            quotedLog.participantJid && myPhoneNum && quotedLog.participantJid.includes(myPhoneNum)
          );

          let participantJid: string | undefined = undefined;

          if (isGroup) {
            if (isQuotedFromMe) {
              participantJid = myPhoneJid;
            } else {
              let cand: string | null | undefined = quotedLog.participantJid;
              if (cand && (cand.includes('120363') || cand.endsWith('@g.us'))) {
                cand = null;
              }

              if (!cand) {
                const phoneMatch = (quotedLog.message || '').match(/\b(62\d{8,13}|08\d{8,12}|\d{10,15})\b/);
                if (phoneMatch && phoneMatch[1]) {
                  let num = phoneMatch[1];
                  if (num.startsWith('0')) num = '62' + num.slice(1);
                  if (!num.startsWith('120363')) cand = `${num}@s.whatsapp.net`;
                } else {
                  const senderNameMatch = (quotedLog.message || '').match(/^\[([^\]]+)\]:/);
                  if (senderNameMatch && senderNameMatch[1]) {
                    const senderName = senderNameMatch[1].trim();
                    try {
                      const matchedContact = await this.contactRepo.findOne({
                        where: [
                          { tenantId: device.tenantId as string, name: senderName },
                          { tenantId: device.tenantId as string, pushName: senderName },
                        ],
                      });
                      if (matchedContact) {
                        cand = matchedContact.jid || (matchedContact.phoneNumber ? `${matchedContact.phoneNumber.replace(/[^0-9]/g, '')}@s.whatsapp.net` : null);
                      }
                    } catch (err) {
                      // ignore
                    }
                  }
                }
              }

              if (!cand) {
                try {
                  const groupMeta = await sock.groupMetadata(formattedJid);
                  if (groupMeta?.participants && groupMeta.participants.length > 0) {
                    const otherPart = groupMeta.participants.find(
                      (p: any) => p.id && myPhoneNum && !p.id.includes(myPhoneNum)
                    );
                    if (otherPart) {
                      cand = otherPart.id;
                    } else {
                      cand = groupMeta.participants[0].id;
                    }
                  }
                } catch (err) {
                  // ignore
                }
              }

              if (cand) {
                const cleanCand = cand.split(':')[0];
                if (!cleanCand.includes('120363') && !cleanCand.endsWith('@g.us')) {
                  participantJid = cleanCand;
                }
              }
            }
          }

          let cleanQuotedText = quotedLog.message || '';
          const groupMatch = cleanQuotedText.match(/^\[([^\]]+)\]:\s*(.*)/s) || cleanQuotedText.match(/^\[~([^\]]+)\]\s*(.*)/s);
          if (groupMatch) {
            cleanQuotedText = groupMatch[2];
          }

          const quotedKey: any = {
            remoteJid: formattedJid,
            fromMe: isQuotedFromMe,
            id: quotedLog.messageId,
          };

          if (isGroup && participantJid) {
            quotedKey.participant = participantJid;
          }

          sendOptions.quoted = {
            key: quotedKey,
            message: {
              conversation: cleanQuotedText,
            },
          };

          console.log(`[WhatsApp] Quoted message successfully attached for ${quotedMessageId}:`, JSON.stringify(sendOptions.quoted));
        } else {
          console.warn(`[WhatsApp] Quoted log tidak ditemukan di DB untuk messageId: ${quotedMessageId}`);
        }
      } catch (err) {
        console.warn(`[WhatsApp] Gagal menambahkan opsi kutipan pesan ${quotedMessageId}:`, err);
      }
    }

    const res = await sock.sendMessage(formattedJid, payload, sendOptions);

    // Simpan riwayat pesan keluar ke database (OUT)
    try {
      const outMyNum = sock.user?.id ? sock.user.id.split(':')[0].split('@')[0] : '';
      const outMyJid = outMyNum ? `${outMyNum}@s.whatsapp.net` : null;
      const logEntry = this.logRepo.create({
        deviceId,
        tenantId: device.tenantId,
        phoneNumber: formattedJid.endsWith('@s.whatsapp.net') ? formattedJid.split('@')[0] : formattedJid,
        message: mediaTypeLabel ? `[${mediaTypeLabel}] ${text || ''}` : text,
        mediaUrl: finalMediaUrlToSave,
        direction: 'OUT',
        messageId: res?.key?.id || null,
        participantJid: formattedJid.endsWith('@g.us') ? outMyJid : null,
        quotedMessageId: quotedMessageId || null,
        chatType: formattedJid.endsWith('@g.us') ? 'GROUP' : 'PERSONAL',
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
    mediaFileOrUrl?: any,
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
    phoneNumber?: string,
    chatTypeFilter?: 'GROUP' | 'PERSONAL',
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const userRole = this.tenantContext.getRole();

    const qb = this.logRepo.createQueryBuilder('log');

    // Filter berdasarkan tenant (kecuali Super Admin)
    if (userRole !== 'Super Admin') {
      if (!tenantId) throw new BadRequestException('Context tenant tidak ditemukan.');
      qb.where('log.tenantId = :tenantId', { tenantId });
    }

    // Filter opsional: Tipe percakapan (GROUP / PERSONAL)
    if (chatTypeFilter) {
      if (chatTypeFilter === 'GROUP') {
        qb.andWhere("(log.chatType = 'GROUP' OR log.phoneNumber LIKE '%@g.us')");
      } else {
        qb.andWhere("(log.chatType = 'PERSONAL' OR log.chatType IS NULL)");
        qb.andWhere("log.phoneNumber NOT LIKE '%@g.us'");
      }
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

    // Filter opsional: phoneNumber spesifik per kontak (Pemisahan Mutlak Chat Grup vs Chat Pribadi)
    if (phoneNumber && phoneNumber.trim()) {
      const rawPhone = phoneNumber.trim();
      const cleanTarget = rawPhone.replace(/^[\s+]+/, '');
      const isTargetGroup = rawPhone.endsWith('@g.us') || rawPhone.includes('@g.us') || (cleanTarget.includes('-') && !cleanTarget.startsWith('62') && !cleanTarget.startsWith('08') && cleanTarget.length > 15);

      if (isTargetGroup) {
        // PERCAKAPAN GRUP: Hanya ambil log yang phoneNumber-nya cocok dengan ID Grup ini
        const groupCleanId = rawPhone.split('@')[0];
        qb.andWhere('(log.phoneNumber = :rawPhone OR log.phoneNumber LIKE :groupPattern OR log.phoneNumber = :groupCleanId)', {
          rawPhone,
          groupPattern: `%${groupCleanId}%`,
          groupCleanId,
        });
      } else {
        // PERCAKAPAN PRIBADI: Hanya ambil log pesan pribadi (TIDAK BOLEH mencakup log grup @g.us)
        const digits = rawPhone.replace(/[^0-9]/g, '');
        const lastDigits = digits.length >= 8 ? digits.slice(-8) : digits;

        const relatedJids: string[] = [
          rawPhone,
          rawPhone.replace(/^[\s+]+/, ''),
          `+${digits}`,
          digits,
          `${digits}@s.whatsapp.net`,
        ];

        if (digits.startsWith('62')) {
          const localFormat = `0${digits.slice(2)}`;
          relatedJids.push(localFormat, `+${localFormat}`);
        } else if (digits.startsWith('0')) {
          const intlFormat = `62${digits.slice(1)}`;
          relatedJids.push(intlFormat, `+${intlFormat}`, `${intlFormat}@s.whatsapp.net`);
        }

        if (tenantId) {
          const matchingContacts = await this.contactRepo.find({
            where: [
              { tenantId, phoneNumber: rawPhone },
              { tenantId, phoneNumber: `+${digits}` },
              { tenantId, phoneNumber: digits },
              { tenantId, jid: rawPhone },
              { tenantId, jid: `${digits}@s.whatsapp.net` },
              ...(digits ? [{ tenantId, phoneNumber: ILike(`%${digits}%`) }] : []),
            ],
          });
          for (const c of matchingContacts) {
            if (c.phoneNumber && !c.phoneNumber.endsWith('@g.us') && !relatedJids.includes(c.phoneNumber)) {
              relatedJids.push(c.phoneNumber);
            }
            if (c.jid && !c.jid.endsWith('@g.us') && !relatedJids.includes(c.jid)) {
              relatedJids.push(c.jid);
            }
          }
        }

        const digitsPattern = digits ? `%${digits}%` : '%XYZ_NONE%';
        const lastDigitsPattern = lastDigits ? `%${lastDigits}%` : '%XYZ_NONE%';

        qb.andWhere("log.phoneNumber NOT LIKE '%@g.us'");
        qb.andWhere(
          '(log.phoneNumber IN (:...relatedJids) OR (length(:digits) > 5 AND log.phoneNumber LIKE :digitsPattern) OR (length(:lastDigits) > 5 AND log.phoneNumber LIKE :lastDigitsPattern))',
          {
            relatedJids,
            digits: digits || 'XYZ_NONE',
            digitsPattern,
            lastDigits: lastDigits || 'XYZ_NONE',
            lastDigitsPattern,
          },
        );
      }
    }

    qb.leftJoinAndMapOne(
      'log.contactInfo',
      'whatsapp_contacts',
      'contact',
      'contact.phone_number = log.phoneNumber AND contact.tenant_id = log.tenantId'
    );

    const [items, total] = await qb
      .orderBy('log.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const mappedItems = items.map((item: any) => {
      if (!item.chatType) {
        const phone = item.phoneNumber || '';
        const isGroup = phone.endsWith('@g.us') || (phone.includes('-') && !phone.startsWith('62') && !phone.startsWith('08'));
        item.chatType = isGroup ? 'GROUP' : 'PERSONAL';
      }
      
      // Inject contact name if joined
      if (item.contactInfo) {
        item.senderName = item.contactInfo.name || item.contactInfo.push_name || item.contactInfo.pushName;
      }
      
      return item;
    });

    return {
      items: mappedItems,
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
   * Cari kontak di tenant yang cocok dengan LID murni berdasarkan JID atau Nomor HP pengirim (TIDAK BERDASARKAN PUSHNAME)
   */
  private async findLinkedContactForLid(tenantId: string, lid: string, pushName?: string) {
    if (!tenantId || !lid) return null;

    try {
      const cleanLidDigits = lid.split('@')[0].replace(/[^0-9]/g, '');
      const contact = await this.contactRepo.findOne({
        where: [
          { tenantId, jid: lid },
          { tenantId, jid: ILike(`%${cleanLidDigits}%`) },
        ],
      });

      if (contact && contact.phoneNumber && !contact.phoneNumber.endsWith('@g.us') && !contact.phoneNumber.includes('@lid') && contact.phoneNumber.length < 14) {
        return contact;
      }
    } catch (err: any) {
      console.warn('[WhatsApp] Gagal menautkan kontak LID:', err.message);
    }

    return null;
  }

  /**
   * Otomatis sinkronisasi/upsert kontak dari pesan masuk/keluar WA MURNI BERDASARKAN NOMOR TELEPON PENGIRIM
   */
  private async upsertContactFromMessage(tenantId: string, jid: string, pushName?: string) {
    if (!tenantId || !jid || jid.endsWith('@g.us') || jid.includes('-')) return;

    try {
      const cleanJid = jid.includes('@') ? jid : `${jid}@s.whatsapp.net`;
      const phoneNumber = cleanJid.split('@')[0].replace(/[^0-9]/g, '');
      if (!phoneNumber || phoneNumber.length > 15 || phoneNumber.startsWith('1415') || phoneNumber.includes('@lid')) {
        return;
      }

      let contact = await this.contactRepo.findOneBy({ tenantId, phoneNumber });
      if (!contact) {
        contact = await this.contactRepo.findOneBy({ tenantId, jid: cleanJid });
      }

      if (!contact) {
        contact = this.contactRepo.create({
          tenantId,
          jid: cleanJid,
          phoneNumber,
          name: pushName || phoneNumber,
          pushName: pushName || null,
        } as any) as unknown as WhatsappContact;
      } else {
        if (pushName && (!contact.pushName || contact.pushName === contact.phoneNumber)) {
          contact.pushName = pushName;
        }
        if (pushName && (!contact.name || contact.name === contact.phoneNumber)) {
          contact.name = pushName;
        }
        if (!contact.jid || contact.jid !== cleanJid) {
          contact.jid = cleanJid;
        }
      }

      if (contact) {
        await this.contactRepo.save(contact);
      }
    } catch (err: any) {
      console.warn('[WhatsApp] Gagal auto-upsert kontak:', err.message);
    }
  }

  /**
   * Mematikan/logout sesi perangkat
   */
  async logoutSession(deviceId: string, clearData = false): Promise<void> {
    const dev = await this.deviceRepo.findOneBy({ id: deviceId });
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
    this.qrCodes.delete(deviceId);

    // Jika user memilih untuk mereset riwayat dan kontak saat ganti nomor
    if (clearData && dev && dev.tenantId) {
      try {
        await this.logRepo.delete({ tenantId: dev.tenantId as string });
        await this.contactRepo.delete({ tenantId: dev.tenantId as string });

        const tenantSlug = await this.getTenantSlug(dev.tenantId as string);
        const { absoluteFolder: galleryFolder } = UploadStorageHelper.getUploadPath(tenantSlug, 'gallery', 'whatsapp-media');
        const { absoluteFolder: docFolder } = UploadStorageHelper.getUploadPath(tenantSlug, 'documents', 'whatsapp-media');
        
        if (fs.existsSync(galleryFolder)) fs.rmSync(galleryFolder, { recursive: true, force: true });
        if (fs.existsSync(docFolder)) fs.rmSync(docFolder, { recursive: true, force: true });

        console.log(`[WhatsApp] Data riwayat, kontak, dan file media untuk Device ID ${deviceId} telah direset.`);
      } catch (dbErr) {
        console.error(`[WhatsApp] Gagal mereset data riwayat/kontak/media:`, dbErr);
      }
    }
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

  /**
   * Mengambil daftar master kontak pengguna per tenant
   */
  async getContacts(page = 1, limit = 20, search?: string) {
    const tenantId = this.tenantContext.getTenantId();
    const userRole = this.tenantContext.getRole();

    const qb = this.contactRepo.createQueryBuilder('contact');

    if (userRole !== 'Super Admin') {
      if (!tenantId) throw new BadRequestException('Context tenant tidak ditemukan.');
      qb.where('contact.tenantId = :tenantId', { tenantId });
    }

    if (search && search.trim()) {
      qb.andWhere(
        '(contact.name ILIKE :search OR contact.phoneNumber ILIKE :search OR contact.pushName ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    const [items, total] = await qb
      .orderBy('contact.name', 'ASC', 'NULLS LAST')
      .addOrderBy('contact.createdAt', 'DESC')
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
   * Tambah atau update kontak secara manual
   */
  async saveContact(data: { phoneNumber: string; name?: string; pushName?: string }) {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) throw new BadRequestException('Context tenant tidak ditemukan.');

    const jid = this.formatToWhatsappJid(data.phoneNumber);
    if (!jid) throw new BadRequestException('Nomor telepon tidak valid.');

    const phoneNumber = jid.split('@')[0];

    let contact = await this.contactRepo.findOneBy({ tenantId, jid });
    if (!contact) {
      contact = this.contactRepo.create({
        tenantId,
        jid,
        phoneNumber,
        name: data.name || null,
        pushName: data.pushName || null,
      } as any) as unknown as WhatsappContact;
    } else {
      if (data.name !== undefined) contact.name = data.name;
      if (data.pushName !== undefined) contact.pushName = data.pushName;
    }

    return await this.contactRepo.save(contact!);
  }

  /**
   * Hapus kontak dari master data
   */
  async deleteContact(id: string) {
    const tenantId = this.tenantContext.getTenantId();
    const userRole = this.tenantContext.getRole();

    const contact = await this.contactRepo.findOneBy({ id });
    if (!contact) throw new BadRequestException('Kontak tidak ditemukan.');

    if (userRole !== 'Super Admin' && contact.tenantId !== tenantId) {
      throw new BadRequestException('Akses ditolak.');
    }

    await this.contactRepo.remove(contact);
    return { success: true, message: 'Kontak berhasil dihapus.' };
  }
  /**
   * Reset perhitungan pesan belum dibaca untuk tenant saat ini
   */
  async resetUnreadCount() {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) throw new BadRequestException('Context tenant tidak ditemukan.');
    
    const unreadKey = `wa:unread:tenant:${tenantId}`;
    await this.redis.set(unreadKey, 0);
    this.wsGateway.emitUnreadUpdate(tenantId, 0);
    
    return { success: true, message: 'Notifikasi berhasil direset.' };
  }
  /**
   * Mengambil jumlah pesan belum dibaca untuk tenant saat ini
   */
  async getUnreadCount() {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) throw new BadRequestException('Context tenant tidak ditemukan.');
    
    const unreadKey = `wa:unread:tenant:${tenantId}`;
    const val = await this.redis.get(unreadKey);
    return { count: val ? parseInt(val, 10) : 0 };
  }

  /**
   * Melakukan streaming file media WhatsApp ke client (Frontend/Browser)
   */
  streamMedia(rawPath: string, req: any, res: any) {
    const filePath = UploadStorageHelper.resolveFileForStreaming(rawPath, 'whatsapp');

    if (!filePath) {
      throw new NotFoundException('File media WhatsApp tidak ditemukan');
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.webm') contentType = 'video/webm';
    else if (ext === '.pdf') contentType = 'application/pdf';

    const MAX_CHUNK_SIZE = 3 * 1024 * 1024; // 3MB chunk

    if (range && contentType.startsWith('video/')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      
      if (isNaN(start) || start >= fileSize || start < 0) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }

      let end = parts[1] ? parseInt(parts[1], 10) : start + MAX_CHUNK_SIZE - 1;
      if (isNaN(end) || end - start + 1 > MAX_CHUNK_SIZE) end = start + MAX_CHUNK_SIZE - 1;
      if (end >= fileSize) end = fileSize - 1;
      if (start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }

      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      });

      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      });

      fs.createReadStream(filePath).pipe(res);
    }
  }
}
