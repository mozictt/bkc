import { Controller, Post, Get, Delete, Body, Param, Query, NotFoundException } from '@nestjs/common';
import { WhatsappService } from './whatsapp.service';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';

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
  @ApiOperation({ summary: 'Mengambil riwayat log pesan WhatsApp tenant saat ini' })
  async getLogs(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return await this.waService.getMessageLogs(+page, +limit);
  }

  @Post('send')
  @ApiOperation({ summary: 'Mengirim pesan teks WhatsApp' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', example: '1' },
        to: { type: 'string', example: '628123456789' },
        text: { type: 'string', example: 'Halo, ini tes pesan!' },
      },
      required: ['deviceId', 'to', 'text'],
    },
  })
  async send(
    @Body('deviceId') deviceId: string,
    @Body('to') to: string,
    @Body('text') text: string,
  ) {
    const res = await this.waService.sendMessage(deviceId, to, text);
    return { success: true, messageId: res.key.id };
  }

  @Post('broadcast')
  @ApiOperation({ summary: 'Mengirim broadcast pesan ke banyak nomor sekaligus (background task)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        deviceId: { type: 'string', example: '1' },
        recipients: { type: 'array', items: { type: 'string' }, example: ['628123456789', '628987654321'] },
        text: { type: 'string', example: 'Halo! Ini pesan broadcast.' },
        delay: { type: 'number', example: 3000 },
      },
      required: ['deviceId', 'recipients', 'text'],
    },
  })
  async broadcast(
    @Body('deviceId') deviceId: string,
    @Body('recipients') recipients: string[],
    @Body('text') text: string,
    @Body('delay') delay = 3000,
  ) {
    return await this.waService.startBroadcast(deviceId, recipients, text, delay);
  }

  @Delete('session/:deviceId')
  @ApiOperation({ summary: 'Mematikan / logout sesi WhatsApp perangkat secara permanen' })
  async logout(@Param('deviceId') deviceId: string) {
    await this.waService.logoutSession(deviceId);
    return { success: true, message: `Sesi device ${deviceId} berhasil dimatikan.` };
  }
}
