import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contribution } from './entities/contribution.entity';
import { CreateContributionDto } from './dto/create-contribution.dto';

@Injectable()
export class ContributionsService {
  constructor(
    @InjectRepository(Contribution)
    private readonly contributionRepo: Repository<Contribution>,
  ) {}

  async findByProject(projectId: string): Promise<Contribution[]> {
    return this.contributionRepo.find({
      where: { projectId },
      relations: ['beneficiary'],
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  async create(projectId: string, dto: CreateContributionDto): Promise<Contribution> {
    const contribution = this.contributionRepo.create({
      projectId,
      beneficiaryId: dto.beneficiaryId,
      amount: dto.amount,
      date: dto.date ? new Date(dto.date) : new Date(),
      note: dto.note,
    });
    return this.contributionRepo.save(contribution);
  }

  async remove(id: string): Promise<void> {
    const c = await this.contributionRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Aporte no encontrado');
    await this.contributionRepo.remove(c);
  }
}
