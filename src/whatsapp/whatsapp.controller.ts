import { Controller, Post, Get, Delete, Put, Body, Param, Query, NotFoundException, UseInterceptors, UploadedFile, BadRequestException, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { WhatsappService } from './whatsapp.service';
import { ApiTags, ApiOperation, ApiBody, ApiConsumes, ApiQuery } from '@nestjs/swagger';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly waService: WhatsappService) {}

  @Post('session/init')
  @ApiOperation({ summary: 'Inisiasi sesi baru WhatsApp berdasarkan Device ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', example: '1' },
      },
      required: ['deviceId'],
    },
  })
  async initSession(@Body('deviceId') deviceId: string) {
    await this.waService.initSession(deviceId);
    return { message: `Inisialisasi device ${deviceId} berhasil dijalankan. Silakan cek QR Code.` };
  }

  @Get('session/qr')
  @ApiOperation({ summary: 'Mendapatkan QR Code untuk scan pairing (dikembalikan dalam bentuk raw string)' })
  getQr(@Query('deviceId') deviceId: string) {
    const qr = this.waService.getQrCode(deviceId);
    if (!qr) {
      throw new NotFoundException('QR Code belum siap atau perangkat sudah terhubung. Pastikan Anda memanggil /session/init terlebih dahulu.');
    }
    return { qr };
  }

  @Get('devices')
  @ApiOperation({ summary: 'Mendapatkan daftar semua Device ID yang sedang terhubung' })
  getDevices() {
    return { devices: this.waService.getActiveDevices() };
  }

  @Get('logs')
  @ApiOperation({ summary: 'Mengambil riwayat log pesan WhatsApp tenant saat ini dengan filter opsional (direction, search, deviceId, phoneNumber)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'direction', required: false, enum: ['IN', 'OUT'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'deviceId', required: false, type: String })
  @ApiQuery({ name: 'phoneNumber', required: false, type: String, description: 'Filter riwayat pesan khusus untuk nomor telepon kontak tertentu' })
  @ApiQuery({ name: 'chatType', required: false, enum: ['GROUP', 'PERSONAL'], description: 'Filter tipe percakapan (GROUP / PERSONAL)' })
  async getLogs(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('direction') direction?: 'IN' | 'OUT',
    @Query('search') search?: string,
    @Query('deviceId') deviceId?: string,
    @Query('phoneNumber') phoneNumber?: string,
    @Query('chatType') chatType?: 'GROUP' | 'PERSONAL',
  ) {
    return await this.waService.getMessageLogs(+page, +limit, direction, search, deviceId, phoneNumber, chatType);
  }

  @Get('read-notifications')
  @ApiOperation({ summary: 'Mendapatkan jumlah notifikasi pesan WhatsApp yang belum terbaca' })
  async getUnreadCount() {
    return await this.waService.getUnreadCount();
  }

  @Put('read-notifications')
  @ApiOperation({ summary: 'Mereset notifikasi pesan WhatsApp yang belum terbaca' })
  async markAsRead() {
    return await this.waService.resetUnreadCount();
  }

  @Post('send')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Mengirim pesan WhatsApp (Teks dan/atau Foto, Video, PDF)' })
  async send(
    @Body('deviceId') deviceId: string,
    @Body('to') to: string,
    @Body('text') text: string,
    @UploadedFile() file?: any,
    @Body('mediaUrl') mediaUrl?: string,
    @Body('quotedMessageId') quotedMessageId?: string,
  ) {
    const target = file || mediaUrl;
    const res = await this.waService.sendMessage(deviceId, to, text, target, undefined, quotedMessageId);
    return { success: true, messageId: res?.key?.id };
  }

  @Post('broadcast')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Mengirim broadcast pesan ke banyak nomor sekaligus (Teks dan/atau Foto, Video, PDF)' })
  async broadcast(
    @Body('deviceId') deviceId: string,
    @Body('recipients') recipientsRaw: any,
    @Body('text') text: string,
    @UploadedFile() file?: any,
    @Body('mediaUrl') mediaUrl?: string,
  ) {
    let recipients: string[] = [];
    if (typeof recipientsRaw === 'string') {
      recipients = recipientsRaw.split(/[\n,;]/).map((r) => r.trim()).filter(Boolean);
    } else if (Array.isArray(recipientsRaw)) {
      recipients = recipientsRaw;
    }

    if (recipients.length === 0) {
      throw new BadRequestException('Daftar penerima broadcast tidak boleh kosong.');
    }

    const target = file || mediaUrl;
    return await this.waService.startBroadcast(deviceId, recipients, text, target);
  }

  @Delete('session/:deviceId')
  @ApiOperation({ summary: 'Mematikan / logout sesi WhatsApp perangkat secara permanen' })
  async logout(
    @Param('deviceId') deviceId: string,
    @Query('clearData') clearData?: string,
  ) {
    const shouldClear = clearData === 'true' || clearData === '1';
    await this.waService.logoutSession(deviceId, shouldClear);
    return { 
      success: true, 
      message: `Sesi device ${deviceId} berhasil dimatikan.${shouldClear ? ' Seluruh riwayat dan kontak terkait telah di-reset.' : ''}` 
    };
  }

  @Get('contacts')
  @ApiOperation({ summary: 'Mengambil daftar Master Kontak Pengguna per tenant' })
  async getContacts(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
  ) {
    return await this.waService.getContacts(+page, +limit, search);
  }

  @Post('contacts')
  @ApiOperation({ summary: 'Menambah atau memperbarui data Kontak Pengguna' })
  async saveContact(@Body() body: { phoneNumber: string; name?: string; pushName?: string }) {
    return await this.waService.saveContact(body);
  }

  @Delete('contacts/:id')
  @ApiOperation({ summary: 'Menghapus data kontak dari Master Kontak' })
  async deleteContact(@Param('id') id: string) {
    return await this.waService.deleteContact(id);
  }

  @Get('groups')
  @ApiOperation({ summary: 'Mendapatkan daftar grup WhatsApp yang diikuti oleh perangkat' })
  @ApiQuery({ name: 'deviceId', required: true, type: String })
  async getGroups(@Query('deviceId') deviceId: string) {
    if (!deviceId) throw new BadRequestException('deviceId wajib diisi.');
    return await this.waService.getGroups(deviceId);
  }

  @Get('groups/:groupId')
  @ApiOperation({ summary: 'Mendapatkan rincian informasi metadata grup WhatsApp' })
  @ApiQuery({ name: 'deviceId', required: true, type: String })
  async getGroupMetadata(
    @Query('deviceId') deviceId: string,
    @Param('groupId') groupId: string,
  ) {
    if (!deviceId) throw new BadRequestException('deviceId wajib diisi.');
    return await this.waService.getGroupMetadata(deviceId, groupId);
  }

  @Get('media/*path')
  @ApiOperation({ summary: 'Stream / ambil file media WhatsApp berdasarkan relative path' })
  async getMedia(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const rawPath = (req.params as any).path || req.params[0] || req.params['0'] || '';
    return this.waService.streamMedia(rawPath, req, res);
  }
}
