import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Beneficiary } from './entities/beneficiary.entity';
import { Project } from '../projects/entities/project.entity';
import { BeneficiariesService } from './beneficiaries.service';
import { BeneficiariesController } from './beneficiaries.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Beneficiary, Project])],
  controllers: [BeneficiariesController],
  providers: [BeneficiariesService],
  exports: [BeneficiariesService],
})
export class BeneficiariesModule {}
