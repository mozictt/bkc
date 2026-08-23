import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard'; // Assuming standard auth guard
import { TenantContextService } from '../common/tenant/tenant-context.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/whatsapp',
})
export class WhatsappGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    // Klien dapat bergabung ke room spesifik tenant setelah otentikasi via event
    console.log(`[WhatsApp WebSocket] Klien terhubung: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`[WhatsApp WebSocket] Klien terputus: ${client.id}`);
  }

  /**
   * Klien frontend akan emit event ini setelah terhubung untuk join ke room tenant-nya
   */
  @SubscribeMessage('joinTenant')
  handleJoinTenantRoom(@ConnectedSocket() client: Socket, @MessageBody() data: { tenantId: string }) {
    if (!data?.tenantId) return;
    const room = `tenant_${data.tenantId}`;
    client.join(room);
    console.log(`[WhatsApp WebSocket] Klien ${client.id} bergabung ke room: ${room}`);
  }

  /**
   * Memancarkan event pembaruan notifikasi ke seluruh klien di room tenant tertentu
   */
  emitUnreadUpdate(tenantId: string, count: number) {
    this.server.to(`tenant_${tenantId}`).emit('whatsapp_unread_update', { count });
  }
}
