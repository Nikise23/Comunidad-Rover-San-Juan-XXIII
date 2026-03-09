import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Sale } from './entities/sale.entity';
import { Product } from '../events/entities/product.entity';
import { Event } from '../events/entities/event.entity';
import { Beneficiary } from '../beneficiaries/entities/beneficiary.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(Beneficiary)
    private readonly beneficiaryRepo: Repository<Beneficiary>,
  ) {}

  async create(dto: CreateSaleDto): Promise<Sale> {
    const product = await this.productRepo.findOne({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    const amount = Number(product.pricePerUnit) * dto.quantity;
    const sale = this.saleRepo.create({
      ...dto,
      amount,
    });
    const saved = await this.saleRepo.save(sale);
    await this.recalculateEventTotals(dto.eventId);
    return this.findOne(saved.id);
  }

  async findAll(eventId?: string, beneficiaryId?: string): Promise<Sale[]> {
    const qb = this.saleRepo.createQueryBuilder('s')
      .leftJoinAndSelect('s.beneficiary', 'beneficiary')
      .leftJoinAndSelect('s.event', 'event')
      .leftJoinAndSelect('s.product', 'product')
      .orderBy('s.createdAt', 'DESC');
    if (eventId) qb.andWhere('s.eventId = :eventId', { eventId });
    if (beneficiaryId) qb.andWhere('s.beneficiaryId = :beneficiaryId', { beneficiaryId });
    return qb.getMany();
  }

  async findOne(id: string): Promise<Sale> {
    const sale = await this.saleRepo.findOne({
      where: { id },
      relations: ['beneficiary', 'event', 'product'],
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return sale;
  }

  async update(id: string, dto: UpdateSaleDto): Promise<Sale> {
    const sale = await this.findOne(id);
    if (dto.quantity !== undefined) {
      const product = await this.productRepo.findOne({ where: { id: sale.productId } });
      if (product) sale.amount = Number(product.pricePerUnit) * dto.quantity;
      sale.quantity = dto.quantity;
    }
    Object.assign(sale, dto);
    const saved = await this.saleRepo.save(sale);
    await this.recalculateEventTotals(sale.eventId);
    return this.findOne(saved.id);
  }

  async remove(id: string): Promise<void> {
    const sale = await this.findOne(id);
    const eventId = sale.eventId;
    await this.saleRepo.remove(sale);
    await this.recalculateEventTotals(eventId);
  }

  private async recalculateEventTotals(eventId: string): Promise<void> {
    const result = await this.saleRepo
      .createQueryBuilder('s')
      .select('SUM(s.amount)', 'total')
      .where('s.eventId = :eventId', { eventId })
      .getRawOne();
    const income = parseFloat(result?.total || '0');
    await this.eventRepo.update(eventId, { income });
  }

  async getRankingByEvent(eventId: string): Promise<{ beneficiaryId: string; fullName: string; total: number; scoutEarnings: number }[]> {
    const rows = await this.saleRepo
      .createQueryBuilder('s')
      .select('s.beneficiaryId', 'beneficiaryId')
      .addSelect('SUM(s.amount)', 'total')
      .where('s.eventId = :eventId', { eventId })
      .groupBy('s.beneficiaryId')
      .orderBy('total', 'DESC')
      .getRawMany();
    const beneficiaryIds = rows.map((r) => r.beneficiaryId).filter(Boolean);
    const names = new Map<string, string>();
    if (beneficiaryIds.length > 0) {
      const beneficiaries = await this.beneficiaryRepo.find({
        where: { id: In(beneficiaryIds) },
        select: ['id', 'firstName', 'lastName'],
      });
      beneficiaries.forEach((b: Beneficiary) => names.set(b.id, `${b.firstName} ${b.lastName}`));
    }
    // Ganancia personal por beneficiario: suma de cantidad * (scoutEarningsPerUnit ?? pricePerUnit) por venta
    const salesWithProduct = await this.saleRepo.find({
      where: { eventId },
      relations: ['product'],
    });
    const scoutEarningsByBeneficiary = new Map<string, number>();
    salesWithProduct.forEach((s) => {
      if (!s.beneficiaryId || !s.product) return;
      const product = s.product as Product;
      const pricePerUnit = Number(product.pricePerUnit) || 0;
      const earningsPerUnit = product.scoutEarningsPerUnit != null ? Number(product.scoutEarningsPerUnit) : pricePerUnit;
      const add = (Number(s.quantity) || 0) * earningsPerUnit;
      scoutEarningsByBeneficiary.set(s.beneficiaryId, (scoutEarningsByBeneficiary.get(s.beneficiaryId) ?? 0) + add);
    });
    return rows.map((r) => ({
      beneficiaryId: r.beneficiaryId,
      fullName: names.get(r.beneficiaryId) || 'Sin nombre',
      total: parseFloat(r.total || '0'),
      scoutEarnings: scoutEarningsByBeneficiary.get(r.beneficiaryId) ?? 0,
    }));
  }
}
