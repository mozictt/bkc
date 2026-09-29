import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { QueryNotificationDto } from './dto/query-notification.dto';

@ApiTags('Notifikasi')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Ambil riwayat notifikasi pengguna terautentikasi' })
  @ApiResponse({ status: 200, description: 'Daftar riwayat notifikasi dan unread counter' })
  getUserNotifications(@Req() req: any, @Query() query: QueryNotificationDto) {
    const userId = Number(req.user?.userId || req.user?.sub || req.user?.id);
    return this.notificationsService.getUserNotifications(userId, query);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Ambil jumlah notifikasi yang belum dibaca (unread count)' })
  @ApiResponse({ status: 200, description: 'Jumlah unread count' })
  async getUnreadCount(@Req() req: any) {
    const userId = Number(req.user?.userId || req.user?.sub || req.user?.id);
    const unreadCount = await this.notificationsService.getUnreadCount(userId);
    return { unreadCount };
  }

  @Patch('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tandai semua notifikasi pengguna sebagai dibaca' })
  @ApiResponse({ status: 200, description: 'Berhasil menandai semua notifikasi sebagai dibaca' })
  markAllAsRead(@Req() req: any) {
    const userId = Number(req.user?.userId || req.user?.sub || req.user?.id);
    return this.notificationsService.markAllAsRead(userId);
  }

  @Patch(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Tandai satu notifikasi spesifik sebagai dibaca' })
  @ApiParam({ name: 'id', description: 'UUID notifikasi' })
  @ApiResponse({ status: 200, description: 'Notifikasi berhasil ditandai sebagai dibaca' })
  markAsRead(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const userId = Number(req.user?.userId || req.user?.sub || req.user?.id);
    return this.notificationsService.markAsRead(id, userId);
  }
}
