// src/company/company.controller.ts
import { Controller, Get, UseGuards, Request, Put, Body, SetMetadata,Param } from '@nestjs/common';
import { CompanyService } from './company.service';
import { AuthGuard } from '@nestjs/passport';


@Controller('company')
export class CompanyController {
    constructor(private readonly companyService: CompanyService) { }

    @UseGuards(AuthGuard('jwt'))
    @SetMetadata('message', 'Profil perusahaan berhasil diambil')
    @Get('profile')
    async getCompanyProfile() {
        return this.companyService.getProfile();
    }

    @UseGuards(AuthGuard('jwt'))
    @SetMetadata('message', 'Profil perusahaan berhasil diperbarui')
    @Put(':id')
    async updateCompanyProfile(@Param('id') id: number, @Body() body) {
        return this.companyService.updateProfile(+id, body);
    }
}
