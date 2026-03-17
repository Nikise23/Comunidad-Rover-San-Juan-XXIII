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
      date: dto.date ?? null,
      note: dto.note ?? null,
    });
    return this.contributionRepo.save(contribution);
  }

  async update(id: string, dto: Partial<CreateContributionDto>): Promise<Contribution> {
    const c = await this.contributionRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Aporte no encontrado');
    if (dto.beneficiaryId !== undefined) {
      c.beneficiaryId = dto.beneficiaryId;
    }
    if (dto.amount !== undefined) {
      c.amount = dto.amount;
    }
    if (dto.date !== undefined) {
      (c as any).date = dto.date ?? null;
    }
    if (dto.note !== undefined) {
      c.note = dto.note ?? null;
    }
    return this.contributionRepo.save(c);
  }

  async remove(id: string): Promise<void> {
    const c = await this.contributionRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Aporte no encontrado');
    await this.contributionRepo.remove(c);
  }
}
