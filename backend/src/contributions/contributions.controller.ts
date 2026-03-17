import { Controller, Get, Post, Body, Param, Delete, Patch } from '@nestjs/common';
import { ContributionsService } from './contributions.service';
import { CreateContributionDto } from './dto/create-contribution.dto';

@Controller('contributions')
export class ContributionsController {
  constructor(private readonly contributionsService: ContributionsService) {}

  @Get('project/:projectId')
  listByProject(@Param('projectId') projectId: string) {
    return this.contributionsService.findByProject(projectId);
  }

  @Post('project/:projectId')
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateContributionDto,
  ) {
    return this.contributionsService.create(projectId, dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateContributionDto>) {
    return this.contributionsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.contributionsService.remove(id);
  }
}
