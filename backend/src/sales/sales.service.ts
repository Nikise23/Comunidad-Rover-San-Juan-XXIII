import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Sale } from './entities/sale.entity';
import { Product } from '../events/entities/product.entity';
import { Event } from '../events/entities/event.entity';
import { Beneficiary } from '../beneficiaries/entities/beneficiary.entity';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';

function stripCsvBom(raw: string): string {
  if (raw.length > 0 && raw.charCodeAt(0) === 0xfeff) return raw.slice(1);
  return raw;
}

function guessCsvDelimiter(firstLine: string): ',' | ';' {
  const semi = [...firstLine.matchAll(/;/g)].length;
  const comma = [...firstLine.matchAll(/,/g)].length;
  if (semi >= 2 && semi > comma) return ';';
  return ',';
}

function parseDelimitedCsvLine(line: string, sep: ',' | ';'): string[] {
  const out: string[] = [];
  let cur = '';
  let i = 0;
  let inQuotes = false;
  while (i < line.length) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cur += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === sep) {
      out.push(cur);
      cur = '';
      i++;
      continue;
    }
    cur += c;
    i++;
  }
  out.push(cur);
  return out.map((cell) => cell.trim());
}

function normCsvHeaderCell(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '');
}

type SalesCsvCols = { protIdx: number; prodIdx: number; qtyIdx: number };

function detectSalesCsvColumns(headerCells: string[]): SalesCsvCols | null {
  let protIdx = -1;
  let prodIdx = -1;
  let qtyIdx = -1;
  for (let i = 0; i < headerCells.length; i++) {
    const h = normCsvHeaderCell(headerCells[i]);
    if ((h.includes('protagonista') || h.includes('scout')) && protIdx < 0) protIdx = i;
    else if (h.includes('producto') && prodIdx < 0) prodIdx = i;
    else if (
      (h.includes('cantidad') || h === 'qty' || h === 'cant' || h.includes('cant.')) &&
      qtyIdx < 0
    )
      qtyIdx = i;
  }
  if (protIdx >= 0 && prodIdx >= 0 && qtyIdx >= 0) return { protIdx, prodIdx, qtyIdx };
  if (headerCells.length >= 3) return { protIdx: 0, prodIdx: 1, qtyIdx: 2 };
  return null;
}

function personNameKey(cell: string): string {
  return cell.trim().replace(/\s+/g, ' ').toLowerCase();
}

function parseQuantityCell(cell: string): number | null {
  const normalized = cell.trim().replace(/\s+/g, '').replace(',', '.');
  const n = parseFloat(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

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

  /**
   * Importa ventas del evento desde CSV (coma `,` o punto y coma `;`).
   * Columnas: Protagonista, Producto, Cantidad — una venta por fila después de la cabecera.
   */
  async importFromCsv(eventId: string, rawCsv: string): Promise<{ created: number }> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Evento no encontrado');

    const products = await this.productRepo.find({ where: { eventId } });
    if (products.length === 0) {
      throw new BadRequestException('El evento no tiene productos; agregá productos antes de importar ventas.');
    }

    const byProdKey = new Map<string, Product[]>();
    for (const p of products) {
      const k = personNameKey(p.name);
      const arr = byProdKey.get(k) ?? [];
      arr.push(p);
      byProdKey.set(k, arr);
    }

    const beneficiaries = await this.beneficiaryRepo.find({ select: ['id', 'firstName', 'lastName'] });
    const byBenKey = new Map<string, string>();
    for (const b of beneficiaries) {
      const k = personNameKey(`${b.firstName} ${b.lastName}`);
      if (!byBenKey.has(k)) byBenKey.set(k, b.id);
    }

    const lines = stripCsvBom(rawCsv)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((l) => l.replace(/\s+$/, ''))
      .filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV vacío o sin filas de datos (cabecera + al menos una venta).');
    }

    const delim = guessCsvDelimiter(lines[0]);
    const headerCells = parseDelimitedCsvLine(lines[0], delim);
    const cols = detectSalesCsvColumns(headerCells);
    if (!cols) {
      throw new BadRequestException(
        'No se reconoce la cabecera. Use columnas: Protagonista, Producto, Cantidad (nombre de columnas reconocidas o orden fijo primero segunda tercera).',
      );
    }

    const needLen = Math.max(cols.protIdx, cols.prodIdx, cols.qtyIdx) + 1;
    const errors: string[] = [];
    type Op = { beneficiaryId: string; productId: string; quantity: number; amount: number };
    const ops: Op[] = [];

    for (let li = 1; li < lines.length; li++) {
      const lineNo = li + 1;
      const cells = parseDelimitedCsvLine(lines[li], delim);
      if (cells.length < needLen) {
        errors.push(`Línea ${lineNo}: faltan columnas`);
        continue;
      }

      const prot = cells[cols.protIdx] ?? '';
      const prodName = cells[cols.prodIdx] ?? '';
      const qtyRaw = cells[cols.qtyIdx] ?? '';

      if (!prot.trim()) {
        errors.push(`Línea ${lineNo}: falta protagonista`);
        continue;
      }
      const bid = byBenKey.get(personNameKey(prot));
      if (!bid) {
        errors.push(`Línea ${lineNo}: protagonista "${prot.trim()}" no encontrado en la lista de protagonistas`);
        continue;
      }
      if (!prodName.trim()) {
        errors.push(`Línea ${lineNo}: falta nombre de producto`);
        continue;
      }
      const plist = byProdKey.get(personNameKey(prodName));
      if (!plist?.length) {
        errors.push(`Línea ${lineNo}: producto "${prodName.trim()}" no existe en este evento`);
        continue;
      }
      if (plist.length > 1) {
        errors.push(
          `Línea ${lineNo}: hay más de un producto "${prodName.trim()}" en el evento; renombrá uno en Productos.`,
        );
        continue;
      }
      const productRow = plist[0];
      const qty = parseQuantityCell(qtyRaw);
      if (qty === null) {
        errors.push(`Línea ${lineNo}: cantidad inválida (número mayor a 0, puede usar coma o punto decimal)`);
        continue;
      }
      const price = Number(productRow.pricePerUnit) || 0;
      ops.push({
        beneficiaryId: bid,
        productId: productRow.id,
        quantity: qty,
        amount: price * qty,
      });
    }

    if (errors.length > 0) {
      const max = 25;
      const head = errors.slice(0, max).join('\n');
      const more = errors.length > max ? `\n… y ${errors.length - max} error(es)` : '';
      throw new BadRequestException(`Errores en el CSV:\n${head}${more}`);
    }
    if (ops.length === 0) throw new BadRequestException('No hay filas de venta válidas');

    await this.saleRepo.manager.transaction(async (em) => {
      const repo = em.getRepository(Sale);
      for (const op of ops) {
        await repo.insert({
          eventId,
          beneficiaryId: op.beneficiaryId,
          productId: op.productId,
          quantity: op.quantity,
          amount: op.amount,
        });
      }
    });

    await this.recalculateEventTotals(eventId);
    return { created: ops.length };
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
    // Ganancia personal por protagonista: suma de cantidad * (scoutEarningsPerUnit ?? pricePerUnit) por venta
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
