import { Controller, Get, Post, Body, Patch, Param, Delete, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { RafflesService } from './raffles.service';
import { CreateRaffleDto } from './dto/create-raffle.dto';
import { UpdateRaffleDto } from './dto/update-raffle.dto';
import { AssignRaffleNumberDto } from './dto/assign-raffle-number.dto';
import { AssignBlocksDto } from './dto/assign-blocks.dto';
import { AssignContinuousDto } from './dto/assign-continuous.dto';
import { AssignRandomDto } from './dto/assign-random.dto';
import { AssignRangesDto } from './dto/assign-ranges.dto';
import { BulkStatusDto } from './dto/bulk-status.dto';
import { SetNumberStatusDto } from './dto/set-number-status.dto';
import { DrawDto } from './dto/draw.dto';

@Controller('raffles')
export class RafflesController {
  constructor(private readonly rafflesService: RafflesService) {}

  @Post()
  create(@Body() createRaffleDto: CreateRaffleDto) {
    return this.rafflesService.create(createRaffleDto);
  }

  @Get()
  findAll(@Query('eventId') eventId?: string) {
    return this.rafflesService.findAll(eventId);
  }

  @Get(':id/summary')
  getSummary(@Param('id') id: string) {
    return this.rafflesService.getRaffleSummary(id);
  }

  @Get(':id/export/csv')
  async exportCsv(@Param('id') id: string, @Res() res: Response) {
    const csv = await this.rafflesService.getExportCsv(id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rifa-${id.slice(0, 8)}.csv"`);
    res.send(csv);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rafflesService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRaffleDto: UpdateRaffleDto) {
    return this.rafflesService.update(id, updateRaffleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rafflesService.remove(id);
  }

  @Post(':id/numbers/assign')
  assignNumber(@Param('id') id: string, @Body() dto: AssignRaffleNumberDto) {
    return this.rafflesService.assignNumber(id, dto);
  }

  @Post(':id/numbers/assign-blocks')
  assignByBlocks(@Param('id') id: string, @Body() dto: AssignBlocksDto) {
    return this.rafflesService.assignByBlocks(id, dto);
  }

  @Post(':id/numbers/assign-continuous')
  assignContinuous(@Param('id') id: string, @Body() dto: AssignContinuousDto) {
    return this.rafflesService.assignContinuous(id, dto);
  }

  @Post(':id/numbers/assign-random')
  assignRandom(@Param('id') id: string, @Body() dto: AssignRandomDto) {
    return this.rafflesService.assignRandom(id, dto);
  }

  @Post(':id/numbers/assign-ranges')
  assignByRanges(@Param('id') id: string, @Body() dto: AssignRangesDto) {
    return this.rafflesService.assignByRanges(id, dto);
  }

  @Patch(':id/numbers/bulk-status')
  setBulkStatus(@Param('id') id: string, @Body() dto: BulkStatusDto) {
    return this.rafflesService.setBulkStatus(id, dto);
  }

  @Post(':id/numbers/release-unsold')
  releaseUnsold(@Param('id') id: string) {
    return this.rafflesService.releaseUnsold(id);
  }

  @Post(':id/draw')
  draw(@Param('id') id: string, @Body() dto: DrawDto) {
    return this.rafflesService.draw(id, dto.count);
  }

  @Patch(':id/numbers/:number/status')
  setNumberStatus(
    @Param('id') id: string,
    @Param('number') number: string,
    @Body() dto: SetNumberStatusDto,
  ) {
    return this.rafflesService.setNumberStatus(id, parseInt(number, 10), dto.status, dto.soldTo);
  }
}
