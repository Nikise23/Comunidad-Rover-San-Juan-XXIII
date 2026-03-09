import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/entities/project.entity';
import { Event } from '../events/entities/event.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Beneficiary } from '../beneficiaries/entities/beneficiary.entity';
import { Raffle } from '../raffles/entities/raffle.entity';
import { RaffleNumber } from '../raffles/entities/raffle-number.entity';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, Event, Sale, Beneficiary, Raffle, RaffleNumber]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
