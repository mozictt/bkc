import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Public } from '@auth/public.decorator';
import { WilayahService } from './wilayah.service';
import { QueryWilayahDto, QueryKabupatenDto, QueryKecamatanDto, QueryKelurahanDto } from './dto/query-wilayah.dto';

@ApiTags('Wilayah Administratif')
@Controller('wilayah')
export class WilayahController {
  constructor(private readonly wilayahService: WilayahService) {}

  @Public()
  @Get('provinsi')
  @ApiOperation({ summary: 'Mencari data Provinsi (Autocomplete)' })
  @ApiResponse({ status: 200, description: 'Daftar provinsi berhasil ditemukan.' })
  async findProvinsi(@Query() query: QueryWilayahDto) {
    return this.wilayahService.searchProvinsi(query);
  }

  @Public()
  @Get('kabupaten')
  @ApiOperation({ summary: 'Mencari data Kabupaten / Kota (Autocomplete)' })
  @ApiResponse({ status: 200, description: 'Daftar kabupaten/kota berhasil ditemukan.' })
  async findKabupaten(@Query() query: QueryKabupatenDto) {
    return this.wilayahService.searchKabupaten(query);
  }

  @Public()
  @Get('kecamatan')
  @ApiOperation({ summary: 'Mencari data Kecamatan (Autocomplete)' })
  @ApiResponse({ status: 200, description: 'Daftar kecamatan berhasil ditemukan.' })
  async findKecamatan(@Query() query: QueryKecamatanDto) {
    return this.wilayahService.searchKecamatan(query);
  }

  @Public()
  @Get('kelurahan')
  @ApiOperation({ summary: 'Mencari data Kelurahan / Desa (Autocomplete)' })
  @ApiResponse({ status: 200, description: 'Daftar kelurahan/desa berhasil ditemukan.' })
  async findKelurahan(@Query() query: QueryKelurahanDto) {
    return this.wilayahService.searchKelurahan(query);
  }

  @Public()
  @Get('search')
  @ApiOperation({ summary: 'Pencarian Wilayah Global secara Single Autocomplete' })
  @ApiQuery({ name: 'q', required: true, description: 'Nama Kelurahan/Kecamatan/Kabupaten', example: 'Dago' })
  @ApiQuery({ name: 'limit', required: false, type: Number, default: 100 })
  @ApiResponse({ status: 200, description: 'Hasil pencarian wilayah gabungan.' })
  async searchGlobal(
    @Query('q') q: string,
    @Query('limit') limit?: number,
  ) {
    return this.wilayahService.searchGlobal(q, limit ? +limit : 100);
  }
}
