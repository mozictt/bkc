import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger, UseGuards } from '@nestjs/common';
import { PresenceService } from '../presence/presence.service';
import { MessageService } from '../message/message.service';
import { ConversationService } from '../conversation/conversation.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { SendMessageDto } from '../message/dto/send-message.dto';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../entities/notification.entity';

/**
 * ChatGateway — menangani semua koneksi dan event WebSocket real-time.
 *
 * Namespace: /chat (terpisah dari namespace default untuk isolasi)
 * Autentikasi: JWT token dikirim via handshake query atau Authorization header.
 *
 * Socket.IO Rooms:
 * - `conversation:{id}` — setiap percakapan memiliki room sendiri
 * - `tenant:{tenantId}` — semua user dalam satu tenant (untuk broadcast status online)
 */
@WebSocketGateway({
  namespace: 'chat',
  cors: { origin: '*', credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly presenceService: PresenceService,
    private readonly messageService: MessageService,
    private readonly conversationService: ConversationService,
    private readonly tenantContextService: TenantContextService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Lifecycle: Connect & Disconnect ─────────────────────────────────────────

  /**
   * Dipanggil otomatis ketika client terhubung.
   * Validasi JWT, simpan metadata di socket, set user online, join tenant room.
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const payload = this.extractAndVerifyToken(client);
      client.data.userId = Number(payload.sub ?? payload.userId);
      client.data.tenantId = payload.tenantId;
      client.data.username = payload.username;

      // Join room tenant & user agar bisa receive broadcast status online & notification
      await client.join(`tenant:${client.data.tenantId}`);
      await client.join(`user:${client.data.userId}`);

      // Auto-join ke seluruh room percakapan milik user agar notifikasi aktif di semua halaman (termasuk dashboard)
      await this.runInTenantContext(client, async () => {
        try {
          const userConvs = await this.conversationService.findAllByUser();
          for (const conv of userConvs) {
            await client.join(`conversation:${conv.id}`);
          }
        } catch (e) {
          // Ignore auto-join fallback
        }
      });

      // Tandai user sebagai online
      await this.presenceService.setOnline(
        client.data.tenantId,
        client.data.userId,
        client.id,
      );

      // Kirim daftar seluruh user yang sedang online di tenant kepada client ini
      const onlineUserIds = await this.presenceService.getOnlineUsers(client.data.tenantId);
      client.emit('initial_online_users', { userIds: onlineUserIds });

      // Broadcast ke semua user di tenant bahwa user ini online
      this.server.to(`tenant:${client.data.tenantId}`).emit('user_online', {
        userId: client.data.userId,
      });

      this.logger.log(`[Connect] User ${client.data.userId} (socket: ${client.id})`);
    } catch (err) {
      this.logger.warn(`[Connect] Rejected: ${err.message}`);
      client.disconnect(true);
    }
  }

  /**
   * Dipanggil otomatis saat client disconnect.
   * Hapus status online dan broadcast ke tenant HANYA jika tidak ada socket aktif lain dari user tersebut.
   */
  async handleDisconnect(client: Socket): Promise<void> {
    if (!client.data?.userId || !client.data?.tenantId) return;

    // Cek apakah masih ada socket aktif lain milik user ini di room user:{userId}
    const remainingSockets = await this.server.in(`user:${client.data.userId}`).fetchSockets();
    if (remainingSockets.length === 0) {
      await this.presenceService.setOffline(client.data.tenantId, client.data.userId);

      this.server.to(`tenant:${client.data.tenantId}`).emit('user_offline', {
        userId: client.data.userId,
      });
    }

    this.logger.log(`[Disconnect] User ${client.data.userId} (socket: ${client.id})`);
  }

  /** Event dari client untuk meminta daftar user online di tenant secara manual */
  @SubscribeMessage('get_online_users')
  async handleGetOnlineUsers(@ConnectedSocket() client: Socket): Promise<void> {
    if (client.data?.tenantId) {
      const onlineUserIds = await this.presenceService.getOnlineUsers(client.data.tenantId);
      client.emit('initial_online_users', { userIds: onlineUserIds });
    }
  }

  // ─── Events: Percakapan ───────────────────────────────────────────────────────

  /**
   * Client bergabung ke room percakapan.
   * Validasi bahwa user adalah peserta percakapan ini sebelum join room.
   */
  @SubscribeMessage('join_conversation')
  async handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ): Promise<void> {
    try {
      await this.runInTenantContext(client, async () => {
        await this.conversationService.assertParticipant(data.conversationId);
        await client.join(`conversation:${data.conversationId}`);
        this.logger.debug(
          `User ${client.data.userId} joined room conversation:${data.conversationId}`,
        );
      });
    } catch (err) {
      client.emit('error', { event: 'join_conversation', message: err.message });
    }
  }

  /** Client meninggalkan room percakapan */
  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ): Promise<void> {
    await client.leave(`conversation:${data.conversationId}`);
  }

  // ─── Events: Pesan ───────────────────────────────────────────────────────────

  /**
   * Client mengirim pesan baru.
   * Simpan ke DB, lalu broadcast ke semua user di room percakapan.
   */
  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; message: SendMessageDto },
  ): Promise<void> {
    try {
      const { savedMessage, participantUserIds } = await this.runInTenantContext(
        client,
        async () => {
          const msg = await this.messageService.send(data.conversationId, data.message);
          let userIds: number[] = [];
          try {
            const conv = await this.conversationService.findOneRaw(data.conversationId);
            if (conv && conv.participants) {
              userIds = conv.participants.map((p) => p.userId);
            }
          } catch (e) {
            // Ignore participant lookup error
          }
          return { savedMessage: msg, participantUserIds: userIds };
        },
      );

      await this.broadcastNewMessage(data.conversationId, savedMessage, client.data.userId);
    } catch (err) {
      client.emit('error', { event: 'send_message', message: err.message });
    }
  }

  /**
   * Broadcast pesan baru (termasuk balasan thread) ke room conversation
   * dan simpan entri riwayat notifikasi di DB serta broadcast ke channel personal pengguna.
   */
  async broadcastNewMessage(
    conversationId: string,
    savedMessage: any,
    senderUserId?: number,
  ): Promise<void> {
    try {
      let participantUserIds: number[] = [];
      let conv: any = null;
      try {
        conv = await this.conversationService.findOneRaw(conversationId);
        if (conv && conv.participants) {
          participantUserIds = conv.participants
            .filter((p: any) => !p.leftAt)
            .map((p: any) => Number(p.userId));
        }
      } catch (e) {
        this.logger.error(`Failed participant lookup for conversation ${conversationId}: ${e.message}`);
      }

      // Pastikan semua socket aktif dari peserta bergabung ke room conversation
      await Promise.all(
        participantUserIds.map((userId) =>
          userId
            ? this.server.in(`user:${userId}`).socketsJoin(`conversation:${conversationId}`)
            : Promise.resolve(),
        ),
      );

      // Broadcast event new_message ke room percakapan
      this.server.to(`conversation:${conversationId}`).emit('new_message', savedMessage);

      // Ambil nama pengirim & nama grup
      const senderName =
        savedMessage.sender?.pegawai?.name ||
        savedMessage.sender?.username ||
        savedMessage.senderUsername ||
        `User #${senderUserId ?? ''}`;
      const isGroup = conv?.type === 'GROUP' || Boolean(conv?.name);
      const isThreadReply = Boolean(savedMessage.parentMessageId);

      const notifType = isThreadReply
        ? NotificationType.CHAT_THREAD_REPLY
        : isGroup
        ? NotificationType.CHAT_GROUP
        : NotificationType.CHAT_DIRECT;

      const displayTitle = isThreadReply
        ? `Balasan Thread (${senderName})`
        : isGroup
        ? `${senderName} @ ${conv.name || 'Grup'}`
        : senderName;

      const actionUrl = savedMessage.parentMessageId
        ? `/chat?convId=${conversationId}&threadId=${savedMessage.parentMessageId}&msgId=${savedMessage.id}`
        : `/chat?convId=${conversationId}&msgId=${savedMessage.id}`;

      // Loop untuk setiap penerima (bukan pengirim)
      for (const userId of participantUserIds) {
        if (userId && Number(userId) !== Number(senderUserId)) {
          // 1. Send event real-time pesan ke user
          this.server.to(`user:${userId}`).emit('new_message', savedMessage);

          // 2. Simpan notifikasi ke basis data (Persistent Notification History)
          try {
            const notif = await this.notificationsService.createNotification({
              userId: Number(userId),
              tenantId: conv?.tenantId ? String(conv.tenantId) : undefined,
              type: notifType,
              title: displayTitle,
              body: savedMessage.content || (savedMessage.attachmentUrl ? '[Lampiran File]' : 'Pesan baru diterima'),
              actionUrl,
              payload: {
                conversationId,
                messageId: savedMessage.id,
                parentMessageId: savedMessage.parentMessageId || null,
                senderId: senderUserId,
              },
            });

            // 3. Broadcast real-time event notification:new ke user socket
            this.server.to(`user:${userId}`).emit('notification:new', notif);
          } catch (notifErr) {
            this.logger.error(`Failed to create notification for user ${userId}: ${notifErr.message}`);
          }
        }
      }
    } catch (err) {
      this.logger.error(`Error broadcasting new message: ${err.message}`);
    }
  }

  // ─── Events: Typing Indicator ────────────────────────────────────────────────

  /** Broadcast notifikasi "sedang mengetik" ke room percakapan (kecuali pengirim) */
  @SubscribeMessage('typing_start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ): void {
    client.to(`conversation:${data.conversationId}`).emit('user_typing', {
      conversationId: data.conversationId,
      userId: client.data.userId,
      isTyping: true,
    });
  }

  /** Broadcast berhenti mengetik */
  @SubscribeMessage('typing_stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ): void {
    client.to(`conversation:${data.conversationId}`).emit('user_typing', {
      conversationId: data.conversationId,
      userId: client.data.userId,
      isTyping: false,
    });
  }

  // ─── Events: Reaksi & Read Receipt ───────────────────────────────────────────

  /** Toggle reaksi emoji pada pesan */
  @SubscribeMessage('react_message')
  async handleReactMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageId: string; emoji: string },
  ): Promise<void> {
    try {
      const result = await this.runInTenantContext(client, () =>
        this.messageService.toggleReaction(data.conversationId, data.messageId, data.emoji),
      );
      this.server.to(`conversation:${data.conversationId}`).emit('new_reaction', {
        messageId: data.messageId,
        userId: client.data.userId,
        emoji: data.emoji,
        action: result.action,
      });
    } catch (err) {
      client.emit('error', { event: 'react_message', message: err.message });
    }
  }

  /** Tandai pesan terbaca dan broadcast ke room */
  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string; messageId: string },
  ): Promise<void> {
    try {
      await this.runInTenantContext(client, () =>
        this.messageService.markRead(data.conversationId, data.messageId),
      );
      this.server.to(`conversation:${data.conversationId}`).emit('read_receipt', {
        messageId: data.messageId,
        userId: client.data.userId,
        readAt: new Date().toISOString(),
      });
    } catch (err) {
      client.emit('error', { event: 'mark_read', message: err.message });
    }
  }

  /** Heartbeat dari client untuk memperbarui status online */
  @SubscribeMessage('heartbeat')
  async handleHeartbeat(@ConnectedSocket() client: Socket): Promise<void> {
    if (client.data?.tenantId && client.data?.userId) {
      await this.presenceService.refreshPresence(client.data.tenantId, client.data.userId);
    }
  }

  // ─── Helper: Broadcast Publik ─────────────────────────────────────────────────

  /**
   * Broadcast pesan yang diupdate ke room percakapan.
   * Dipanggil dari MessageService setelah edit/delete.
   */
  broadcastMessageUpdate(conversationId: string, message: any): void {
    this.server.to(`conversation:${conversationId}`).emit('message_updated', message);
  }

  broadcastMessageDelete(conversationId: string, messageId: string): void {
    this.server.to(`conversation:${conversationId}`).emit('message_deleted', { messageId });
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────────

  /**
   * Menjalankan callback dalam TenantContext yang sesuai dengan socket client.
   * Diperlukan karena WebSocket tidak melalui TenantMiddleware HTTP.
   */
  private runInTenantContext<T>(client: Socket, callback: () => T | Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.tenantContextService.run(
        client.data.tenantId,
        null,
        null,
        client.data.userId,
        async () => {
          try {
            resolve(await callback());
          } catch (err) {
            reject(err);
          }
        },
      );
    });
  }

  /**
   * Ekstrak dan verifikasi JWT dari handshake WebSocket.
   * Mendukung dua cara: query param `token` atau header `Authorization: Bearer`.
   */
  private extractAndVerifyToken(client: Socket): any {
    const token =
      (client.handshake.query?.token as string) ||
      client.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) throw new WsException('Token tidak ditemukan dalam handshake');

    try {
      return this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new WsException('Token tidak valid atau sudah kadaluarsa');
    }
  }
}
