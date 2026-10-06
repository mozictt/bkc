import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { RequirePermission } from '../../permissions/decorators/require-permission.decorator';
import { FamilyMemberService } from '../services/family-member.service';
import { CreateFamilyMemberDto, UpdateFamilyMemberDto } from '../dto/family-member.dto';

@ApiTags('Rumah Tangga - Anggota Keluarga')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('rumah-tangga/family-members')
export class FamilyMemberController {
  constructor(private readonly memberService: FamilyMemberService) {}

  @Get()
  @RequirePermission('rumah-tangga.kategori', 'view')
  @ApiOperation({ summary: 'List anggota keluarga aktif' })
  async findAll() {
    return this.memberService.findAll();
  }

  @Get(':id')
  @RequirePermission('rumah-tangga.kategori', 'view')
  @ApiOperation({ summary: 'Detail anggota keluarga' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.memberService.findOne(id);
  }

  @Post()
  @RequirePermission('rumah-tangga.kategori', 'create')
  @ApiOperation({ summary: 'Tambah anggota keluarga baru' })
  async create(@Body() dto: CreateFamilyMemberDto) {
    return this.memberService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('rumah-tangga.kategori', 'update')
  @ApiOperation({ summary: 'Update data anggota keluarga' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateFamilyMemberDto,
  ) {
    return this.memberService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('rumah-tangga.kategori', 'delete')
  @ApiOperation({ summary: 'Soft delete anggota keluarga' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.memberService.remove(id);
    return { message: 'Anggota keluarga berhasil dihapus' };
  }
}
