import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@ApiTags('Chat - Kontak')
@ApiBearerAuth()
@Controller('chat/contacts')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Get()
  @ApiOperation({ summary: 'Ambil semua kontak user yang sedang login' })
  @ApiResponse({ status: 200, description: 'Daftar kontak berhasil diambil' })
  findAll() {
    return this.contactService.findAll();
  }

  @Get('search')
  @ApiOperation({ summary: 'Cari user untuk ditambah sebagai kontak' })
  @ApiQuery({ name: 'q', description: 'Kata kunci pencarian (username atau nama pegawai)', required: true })
  @ApiResponse({ status: 200, description: 'Hasil pencarian user' })
  searchUsers(@Query('q') query: string) {
    return this.contactService.searchUsers(query);
  }

  @Post()
  @ApiOperation({ summary: 'Tambah kontak baru' })
  @ApiResponse({ status: 201, description: 'Kontak berhasil ditambahkan' })
  @ApiResponse({ status: 409, description: 'Kontak sudah ada' })
  create(@Body() dto: CreateContactDto) {
    return this.contactService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update nickname atau status blokir kontak' })
  @ApiResponse({ status: 200, description: 'Kontak berhasil diperbarui' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hapus kontak' })
  @ApiResponse({ status: 204, description: 'Kontak berhasil dihapus' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.contactService.remove(id);
  }
}
