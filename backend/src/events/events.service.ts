import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event } from './entities/event.entity';
import { Product } from './entities/product.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  async create(dto: CreateEventDto): Promise<Event> {
    const event = this.eventRepo.create({
      name: dto.name,
      type: dto.type,
      date: new Date(dto.date),
      projectId: dto.projectId,
      responsibleId: dto.responsibleId,
      income: dto.income ?? 0,
      expenses: dto.expenses ?? 0,
    });
    return this.eventRepo.save(event);
  }

  async findAll(projectId?: string): Promise<Event[]> {
    const qb = this.eventRepo.createQueryBuilder('e')
      .leftJoinAndSelect('e.project', 'project')
      .leftJoinAndSelect('e.responsible', 'responsible')
      .leftJoinAndSelect('e.products', 'products')
      .orderBy('e.date', 'DESC');
    if (projectId) qb.andWhere('e.projectId = :projectId', { projectId });
    return qb.getMany();
  }

  async findOne(id: string): Promise<Event> {
    const event = await this.eventRepo.findOne({
      where: { id },
      relations: ['project', 'responsible', 'products'],
    });
    if (!event) throw new NotFoundException('Evento no encontrado');
    return event;
  }

  async update(id: string, dto: UpdateEventDto): Promise<Event> {
    const event = await this.findOne(id);
    Object.assign(event, {
      ...dto,
      date: dto.date ? new Date(dto.date) : event.date,
    });
    return this.eventRepo.save(event);
  }

  async remove(id: string): Promise<void> {
    const event = await this.findOne(id);
    await this.eventRepo.remove(event);
  }

  // Products
  async addProduct(dto: CreateProductDto): Promise<Product> {
    const product = this.productRepo.create(dto);
    return this.productRepo.save(product);
  }

  async updateProduct(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    Object.assign(product, dto);
    return this.productRepo.save(product);
  }

  async removeProduct(id: string): Promise<void> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    await this.productRepo.remove(product);
  }
}
