import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Beneficiary } from './entities/beneficiary.entity';
import { Project } from '../projects/entities/project.entity';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';

@Injectable()
export class BeneficiariesService {
  constructor(
    @InjectRepository(Beneficiary)
    private readonly beneficiaryRepo: Repository<Beneficiary>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  async create(dto: CreateBeneficiaryDto): Promise<Beneficiary> {
    const existing = await this.beneficiaryRepo.findOne({ where: { dni: dto.dni } });
    if (existing) throw new ConflictException('Ya existe un beneficiario con ese DNI');
    const beneficiary = this.beneficiaryRepo.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      dni: dto.dni,
      contact: dto.contact,
      role: dto.role,
      documentationSubmitted: dto.documentationSubmitted ?? false,
    });
    const saved = await this.beneficiaryRepo.save(beneficiary);
    if (dto.projectIds?.length) {
      await this.assignProjects(saved.id, dto.projectIds);
    } else {
      const defaultProject = await this.projectRepo.findOne({
        order: { createdAt: 'ASC' },
        select: ['id'],
      });
      if (defaultProject) {
        await this.assignProjects(saved.id, [defaultProject.id]);
      }
    }
    return this.findOne(saved.id);
  }

  async findAll(): Promise<Beneficiary[]> {
    return this.beneficiaryRepo.find({
      relations: ['projects'],
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Beneficiary> {
    const b = await this.beneficiaryRepo.findOne({
      where: { id },
      relations: ['projects'],
    });
    if (!b) throw new NotFoundException('Beneficiario no encontrado');
    return b;
  }

  async update(id: string, dto: UpdateBeneficiaryDto): Promise<Beneficiary> {
    const beneficiary = await this.findOne(id);
    if (dto.dni && dto.dni !== beneficiary.dni) {
      const existing = await this.beneficiaryRepo.findOne({ where: { dni: dto.dni } });
      if (existing) throw new ConflictException('Ya existe un beneficiario con ese DNI');
    }
    Object.assign(beneficiary, dto);
    delete (beneficiary as any).projectIds;
    await this.beneficiaryRepo.save(beneficiary);
    if (dto.projectIds !== undefined) {
      await this.assignProjects(id, dto.projectIds);
    }
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const b = await this.findOne(id);
    await this.beneficiaryRepo.remove(b);
  }

  async assignProjects(beneficiaryId: string, projectIds: string[]): Promise<void> {
    const b = await this.beneficiaryRepo.findOne({
      where: { id: beneficiaryId },
      relations: ['projects'],
    });
    if (!b) throw new NotFoundException('Beneficiario no encontrado');
    b.projects = projectIds.map((id) => ({ id } as any));
    await this.beneficiaryRepo.save(b);
  }
}
