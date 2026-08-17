import { Controller, Post, Get, Delete, Body, Param, Query, NotFoundException, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WhatsappService } from './whatsapp.service';
import { ApiTags, ApiOperation, ApiBody, ApiConsumes } from '@nestjs/swagger';

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
    @Query('direction') direction?: 'IN' | 'OUT',
    @Query('search') search?: string,
    @Query('deviceId') deviceId?: string,
  ) {
    return await this.waService.getMessageLogs(+page, +limit, direction, search, deviceId);
  }

  @Post('send')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Mengirim pesan WhatsApp (Teks dan/atau Foto, Video, PDF)' })
  async send(
    @Body('deviceId') deviceId: string,
    @Body('to') to: string,
    @Body('text') text: string,
    @UploadedFile() file?: Express.Multer.File,
    @Body('mediaUrl') mediaUrl?: string,
  ) {
    const target = file || mediaUrl;
    const res = await this.waService.sendMessage(deviceId, to, text, target);
    return { success: true, messageId: res.key.id };
  }

  @Post('broadcast')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiOperation({ summary: 'Mengirim broadcast pesan ke banyak nomor sekaligus (Teks dan/atau Foto, Video, PDF)' })
  async broadcast(
    @Body('deviceId') deviceId: string,
    @Body('recipients') recipientsRaw: any,
    @Body('text') text: string,
    @UploadedFile() file?: Express.Multer.File,
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
  async logout(@Param('deviceId') deviceId: string) {
    await this.waService.logoutSession(deviceId);
    return { success: true, message: `Sesi device ${deviceId} berhasil dimatikan.` };
  }
}
