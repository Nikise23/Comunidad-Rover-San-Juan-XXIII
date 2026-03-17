import { Controller, Get, Post, Body, Patch, Param, Delete, Res } from '@nestjs/common';
import { Response } from 'express';
import { BeneficiariesService } from './beneficiaries.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';

@Controller('beneficiaries')
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) {}

  @Post()
  create(@Body() createBeneficiaryDto: CreateBeneficiaryDto) {
    return this.beneficiariesService.create(createBeneficiaryDto);
  }

  @Get()
  findAll() {
    return this.beneficiariesService.findAll();
  }

  @Get('export/csv')
  async exportCsv(@Res() res: Response) {
    const csv = await this.beneficiariesService.exportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=\"protagonistas.csv\"');
    res.send(csv);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.beneficiariesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBeneficiaryDto: UpdateBeneficiaryDto) {
    return this.beneficiariesService.update(id, updateBeneficiaryDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.beneficiariesService.remove(id);
  }
}
