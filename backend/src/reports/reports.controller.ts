import { Controller, Get, Query, Param } from '@nestjs/common';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  getDashboard(@Query('projectId') projectId?: string) {
    return this.reportsService.getDashboard(projectId);
  }

  @Get('project/:id/financial')
  getProjectFinancial(@Param('id') id: string) {
    return this.reportsService.getProjectFinancialSummary(id);
  }

  @Get('project/:id/scout-summary')
  getProjectScoutSummary(@Param('id') projectId: string) {
    return this.reportsService.getProjectScoutSummary(projectId);
  }

  @Get('events/:eventId/raffle-ranking')
  getEventRaffleRanking(@Param('eventId') eventId: string) {
    return this.reportsService.getEventRaffleRanking(eventId);
  }
}
