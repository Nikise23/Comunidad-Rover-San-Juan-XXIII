import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Beneficiary } from './entities/beneficiary.entity';
import { Project } from '../projects/entities/project.entity';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { UpdateBeneficiaryDto } from './dto/update-beneficiary.dto';

const ROLE_SCOUT = 'scout';
const ROLE_PROTAGONISTA = 'protagonista';

function normalizeRole(role: string | null | undefined): string | null {
  if (role == null || role === '') return role ?? null;
  return role.trim().toLowerCase() === ROLE_SCOUT ? ROLE_PROTAGONISTA : role.trim();
}

function mapRoleForResponse(b: Beneficiary): void {
  if (b.role != null && b.role.trim().toLowerCase() === ROLE_SCOUT) (b as any).role = ROLE_PROTAGONISTA;
}

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
    if (existing) throw new ConflictException('Ya existe un protagonista con ese DNI');
    const beneficiary = this.beneficiaryRepo.create({
      firstName: dto.firstName,
      lastName: dto.lastName,
      dni: dto.dni,
      contact: dto.contact,
      birthDate: dto.birthDate ?? null,
      role: normalizeRole(dto.role) ?? dto.role,
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
    const list = await this.beneficiaryRepo.find({
      relations: ['projects'],
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
    list.forEach(mapRoleForResponse);
    return list;
  }

  async findOne(id: string): Promise<Beneficiary> {
    const b = await this.beneficiaryRepo.findOne({
      where: { id },
      relations: ['projects'],
    });
    if (!b) throw new NotFoundException('Protagonista no encontrado');
    mapRoleForResponse(b);
    return b;
  }

  async update(id: string, dto: UpdateBeneficiaryDto): Promise<Beneficiary> {
    const beneficiary = await this.findOne(id);
    if (dto.dni && dto.dni !== beneficiary.dni) {
      const existing = await this.beneficiaryRepo.findOne({ where: { dni: dto.dni } });
      if (existing) throw new ConflictException('Ya existe un protagonista con ese DNI');
    }
    if (dto.birthDate !== undefined) {
      (beneficiary as any).birthDate = dto.birthDate ?? null;
    }
    const { projectIds: _ignoredProjectIds, birthDate: _ignoredBirthDate, ...rest } = dto as any;
    Object.assign(beneficiary, rest);
    delete (beneficiary as any).projectIds;
    if (dto.role !== undefined) {
      beneficiary.role = normalizeRole(dto.role) ?? dto.role;
    }
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
    if (!b) throw new NotFoundException('Protagonista no encontrado');
    b.projects = projectIds.map((id) => ({ id } as any));
    await this.beneficiaryRepo.save(b);
  }

  async exportCsv(): Promise<string> {
    const list = await this.beneficiaryRepo.find({
      relations: ['projects'],
      order: { lastName: 'ASC', firstName: 'ASC' },
    });
    const header = 'Apellido,Nombre,DNI,FechaNacimiento,Rol,Contacto,Documentacion,Proyectos';
    const toDdMmYyyy = (d?: string | null): string => {
      if (!d) return '';
      const base = String(d).slice(0, 10); // YYYY-MM-DD
      const [y, m, day] = base.split('-');
      if (!y || !m || !day) return base;
      return `${day}-${m}-${y}`;
    };
    const escape = (s: string) => {
      const t = String(s ?? '').replace(/"/g, '""');
      return t.includes(',') || t.includes('"') || t.includes('\n') ? `"${t}"` : t;
    };
    const rows = list.map((b) => {
      const proyectos = (b.projects || []).map((p) => p.name).join(' | ');
      const doc = b.documentationSubmitted ? 'Entregada' : 'Pendiente';
      const rol = (b.role || '').trim() === '' ? '' : (b.role || '');
      return [
        b.lastName,
        b.firstName,
        b.dni,
        toDdMmYyyy(b.birthDate),
        rol,
        b.contact || '',
        doc,
        proyectos,
      ].map(escape).join(',');
    });
    return [header, ...rows].join('\n');
  }
}
