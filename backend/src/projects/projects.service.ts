import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project, ProjectStatus } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  async create(dto: CreateProjectDto): Promise<Project> {
    const project = this.projectRepo.create({
      name: dto.name,
      description: dto.description,
      budgetTarget: dto.budgetTarget,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      status: dto.status ?? ProjectStatus.ACTIVE,
    });
    const saved = await this.projectRepo.save(project);
    if (dto.beneficiaryIds?.length) {
      await this.assignBeneficiaries(saved.id, dto.beneficiaryIds);
    }
    return this.findOne(saved.id);
  }

  async findAll(): Promise<Project[]> {
    return this.projectRepo.find({
      relations: ['events', 'beneficiaries'],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Project> {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['events', 'events.products', 'beneficiaries'],
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  async update(id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findOne(id);
    Object.assign(project, {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : project.startDate,
      endDate: dto.endDate ? new Date(dto.endDate) : project.endDate,
    });
    delete (project as any).beneficiaryIds;
    await this.projectRepo.save(project);
    if (dto.beneficiaryIds !== undefined) {
      await this.assignBeneficiaries(id, dto.beneficiaryIds);
    }
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const project = await this.findOne(id);
    await this.projectRepo.remove(project);
  }

  async assignBeneficiaries(projectId: string, beneficiaryIds: string[]): Promise<void> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
      relations: ['beneficiaries'],
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    project.beneficiaries = beneficiaryIds.map((id) => ({ id } as any));
    await this.projectRepo.save(project);
  }
}
