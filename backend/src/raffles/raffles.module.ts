import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../events/entities/event.entity';
import { Raffle } from './entities/raffle.entity';
import { RaffleNumber } from './entities/raffle-number.entity';
import { RafflesService } from './raffles.service';
import { RafflesController } from './raffles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Raffle, RaffleNumber, Event])],
  controllers: [RafflesController],
  providers: [RafflesService],
  exports: [RafflesService],
})
export class RafflesModule {}
