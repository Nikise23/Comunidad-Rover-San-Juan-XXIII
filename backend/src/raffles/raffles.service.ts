import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Event } from '../events/entities/event.entity';
import { Beneficiary } from '../beneficiaries/entities/beneficiary.entity';
import { Raffle } from './entities/raffle.entity';
import { RaffleNumber, RaffleNumberStatus } from './entities/raffle-number.entity';
import { CreateRaffleDto } from './dto/create-raffle.dto';
import { UpdateRaffleDto } from './dto/update-raffle.dto';
import { AssignRaffleNumberDto } from './dto/assign-raffle-number.dto';
import { AssignBlocksDto } from './dto/assign-blocks.dto';
import { AssignContinuousDto } from './dto/assign-continuous.dto';
import { AssignRandomDto } from './dto/assign-random.dto';
import { AssignRangesDto } from './dto/assign-ranges.dto';
import { BulkStatusDto } from './dto/bulk-status.dto';

/** Tamaño máximo de lista IN(...) por UPDATE (Postgres permite miles; chunk evita parsers enormes). */
const BULK_UPDATE_CHUNK = 500;

/** Postgres devuelve `ARRAY_AGG` como string "{1,2,3}" o como array según driver. */
function parsePgNumberArray(raw: unknown): number[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (typeof x === 'string' ? parseInt(x, 10) : Number(x)))
      .filter((n) => Number.isFinite(n));
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '{}' || trimmed === '') return [];
    const inner = trimmed.startsWith('{') && trimmed.endsWith('}') ? trimmed.slice(1, -1) : trimmed;
    if (!inner) return [];
    return inner
      .split(',')
      .map((x) => parseInt(x.trim(), 10))
      .filter((n) => Number.isFinite(n));
  }
  return [];
}

/** Parsea "1-10, 15, 20-25" → [1,2,...,10, 15, 20,...,25] */
function parseRanges(rangesStr: string, maxNumber: number): number[] {
  const result: number[] = [];
  const parts = rangesStr.split(/[\s,]+/).filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map((s) => parseInt(s.trim(), 10));
      if (isNaN(a) || isNaN(b) || a < 1 || b > maxNumber || a > b) continue;
      for (let i = a; i <= b; i++) result.push(i);
    } else {
      const n = parseInt(part, 10);
      if (!isNaN(n) && n >= 1 && n <= maxNumber) result.push(n);
    }
  }
  return [...new Set(result)];
}

/** Quita BOM UTF-8 y normaliza finales de línea. */
function stripCsvBom(raw: string): string {
  if (raw.length > 0 && raw.charCodeAt(0) === 0xfeff) return raw.slice(1);
  return raw;
}

/** Una línea lógica de CSV con comillas tipo RFC4180. */
function parseCsvLine(line: string): string[] {
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
    if (c === ',') {
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

type ImportCsvCols = { protIdx: number; numIdx: number; estIdx: number; comprIdx: number };

function detectImportCsvColumns(headerCells: string[]): ImportCsvCols | null {
  let protIdx = -1;
  let numIdx = -1;
  let estIdx = -1;
  let comprIdx = -1;
  for (let i = 0; i < headerCells.length; i++) {
    const h = normCsvHeaderCell(headerCells[i]);
    if ((h.includes('protagonista') || h.includes('scout')) && protIdx < 0) protIdx = i;
    else if (h.includes('numero') && numIdx < 0) numIdx = i;
    else if (h.includes('estado') && estIdx < 0) estIdx = i;
    else if (h.includes('comprador') && comprIdx < 0) comprIdx = i;
  }
  if (numIdx >= 0 && estIdx >= 0) return { protIdx, numIdx, estIdx, comprIdx };
  if (headerCells.length >= 4) return { protIdx: 0, numIdx: 1, estIdx: 2, comprIdx: 3 };
  return null;
}

function protagonistImportKey(cell: string): string {
  return cell
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function isEmptyProtagonistCell(cell: string): boolean {
  const k = protagonistImportKey(cell);
  return k === '' || k === 'sin asignar';
}

function parseImportStatus(cell: string): RaffleNumberStatus | null {
  const k = cell
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  const map: Record<string, RaffleNumberStatus> = {
    disponible: RaffleNumberStatus.AVAILABLE,
    asignado: RaffleNumberStatus.ASSIGNED,
    reservado: RaffleNumberStatus.RESERVED,
    vendido: RaffleNumberStatus.SOLD,
    no_vendido: RaffleNumberStatus.NOT_SOLD,
  };
  return map[k] ?? null;
}

@Injectable()
export class RafflesService {
  constructor(
    @InjectRepository(Raffle)
    private readonly raffleRepo: Repository<Raffle>,
    @InjectRepository(RaffleNumber)
    private readonly raffleNumberRepo: Repository<RaffleNumber>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(Beneficiary)
    private readonly beneficiaryRepo: Repository<Beneficiary>,
  ) {}

  /** Ingresos del evento según números vendidos (una sola consulta agregada). */
  async recalcRaffleEventIncome(eventId: string): Promise<number> {
    const row = await this.raffleNumberRepo
      .createQueryBuilder('rn')
      .innerJoin('rn.raffle', 'r')
      .select(
        `COALESCE(SUM(CASE WHEN rn.status = :sold THEN CAST(r.pricePerNumber AS double precision) ELSE 0 END), 0)`,
        'total',
      )
      .where('r.eventId = :eventId', { eventId })
      .setParameter('sold', RaffleNumberStatus.SOLD)
      .getRawOne<{ total: string }>();
    const total = Number(row?.total ?? 0);
    await this.eventRepo.update(eventId, { income: total });
    return total;
  }

  async create(dto: CreateRaffleDto): Promise<Raffle> {
    const raffle = this.raffleRepo.create(dto);
    const saved = await this.raffleRepo.save(raffle);
    await this.generateNumbers(saved.id, saved.totalNumbers);
    return this.findOne(saved.id);
  }

  private async generateNumbers(raffleId: string, total: number): Promise<void> {
    const numbers: Partial<RaffleNumber>[] = [];
    for (let i = 1; i <= total; i++) {
      numbers.push({
        raffleId,
        number: i,
        status: RaffleNumberStatus.AVAILABLE,
      });
    }
    await this.raffleNumberRepo.insert(numbers);
  }

  /** Listado ligero: sin números (evita megabytes de JSON). */
  async findAll(eventId?: string): Promise<Raffle[]> {
    const qb = this.raffleRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.event', 'event')
      .orderBy('r.createdAt', 'DESC');
    if (eventId) qb.andWhere('r.eventId = :eventId', { eventId });
    return qb.getMany();
  }

  async findOne(id: string): Promise<Raffle> {
    const raffle = await this.raffleRepo.findOne({
      where: { id },
      relations: ['event', 'numbers', 'numbers.beneficiary'],
      order: { numbers: { number: 'ASC' as const } },
    });
    if (!raffle) throw new NotFoundException('Rifa no encontrada');
    return raffle;
  }

  async update(id: string, dto: UpdateRaffleDto): Promise<Raffle> {
    const raffle = await this.findOne(id);
    const oldTotal = raffle.totalNumbers;
    Object.assign(raffle, dto);
    await this.raffleRepo.save(raffle);
    if (dto.totalNumbers !== undefined && dto.totalNumbers !== oldTotal) {
      const existing = await this.raffleNumberRepo.count({ where: { raffleId: id } });
      if (dto.totalNumbers > existing) {
        const batch: Partial<RaffleNumber>[] = [];
        for (let i = existing + 1; i <= dto.totalNumbers; i++) {
          batch.push({
            raffleId: id,
            number: i,
            status: RaffleNumberStatus.AVAILABLE,
          });
        }
        await this.raffleNumberRepo.insert(batch);
      } else if (dto.totalNumbers < existing) {
        await this.raffleNumberRepo
          .createQueryBuilder()
          .delete()
          .where('raffleId = :id', { id })
          .andWhere('number > :max', { max: dto.totalNumbers })
          .andWhere('status = :status', { status: RaffleNumberStatus.AVAILABLE })
          .execute();
      }
    }
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const raffle = await this.raffleRepo.findOne({ where: { id } });
    if (!raffle) throw new NotFoundException('Rifa no encontrada');
    await this.raffleRepo.remove(raffle);
  }

  async assignNumber(raffleId: string, dto: AssignRaffleNumberDto): Promise<RaffleNumber> {
    const raffleMeta = await this.raffleRepo.findOne({
      where: { id: raffleId },
      select: ['id', 'eventId'],
    });
    if (!raffleMeta) throw new NotFoundException('Rifa no encontrada');
    const rn = await this.raffleNumberRepo.findOne({
      where: { raffleId, number: dto.number },
    });
    if (!rn) throw new BadRequestException(`Número ${dto.number} no existe en esta rifa`);
    rn.beneficiaryId = dto.beneficiaryId ?? null;
    rn.status = dto.status ?? (dto.beneficiaryId ? RaffleNumberStatus.ASSIGNED : RaffleNumberStatus.AVAILABLE);
    const saved = await this.raffleNumberRepo.save(rn);
    if (raffleMeta.eventId) await this.recalcRaffleEventIncome(raffleMeta.eventId);
    return saved;
  }

  async setNumberStatus(raffleId: string, number: number, status: RaffleNumberStatus, soldTo?: string): Promise<RaffleNumber> {
    const rn = await this.raffleNumberRepo.findOne({
      where: { raffleId, number },
      relations: ['beneficiary', 'raffle'],
    });
    if (!rn) throw new NotFoundException('Número no encontrado');
    rn.status = status;
    rn.soldTo = status === RaffleNumberStatus.SOLD ? (soldTo ?? null) : null;
    const saved = await this.raffleNumberRepo.save(rn);
    const raffle = rn.raffle as Raffle;
    if (raffle?.eventId) await this.recalcRaffleEventIncome(raffle.eventId);
    return saved;
  }

  /** Resumen con agregados SQL — no carga todos los números en memoria. */
  async getRaffleSummary(raffleId: string): Promise<{
    total: number;
    available: number;
    assigned: number;
    reserved: number;
    sold: number;
    notSold: number;
    pricePerNumber: number;
    byBeneficiary: {
      beneficiaryId: string;
      fullName: string;
      /** Total de números del cupón (todos los estados con este protagonista; alineado con `numbers`). */
      assigned: number;
      sold: number;
      /** Pendientes de venta efectiva dentro del cupón (= assigned − vendidos). */
      remaining: number;
      moneyCollected: number;
      scoutEarnings: number;
      /** Números del cupón ligados al protagonista (todos los estados con beneficiaryId). */
      numbers: number[];
    }[];
  }> {
    const raffle = await this.raffleRepo.findOne({
      where: { id: raffleId },
      select: ['id', 'pricePerNumber', 'scoutEarningsPerNumber'],
    });
    if (!raffle) throw new NotFoundException('Rifa no encontrada');

    const pricePerNumber = Number(raffle.pricePerNumber) || 0;
    const scoutEarningsPerNum =
      raffle.scoutEarningsPerNumber != null ? Number(raffle.scoutEarningsPerNumber) : pricePerNumber;

    const total = await this.raffleNumberRepo.count({ where: { raffleId } });

    const statusRows = (await this.raffleNumberRepo
      .createQueryBuilder('rn')
      .select('rn.status', 'status')
      .addSelect('COUNT(*)', 'cnt')
      .where('rn.raffleId = :rid', { rid: raffleId })
      .groupBy('rn.status')
      .getRawMany()) as { status: RaffleNumberStatus; cnt: string }[];

    const byStatus = Object.fromEntries(
      statusRows.map((r) => [r.status, parseInt(r.cnt, 10) || 0]),
    ) as Partial<Record<RaffleNumberStatus, number>>;
    const pick = (s: RaffleNumberStatus) => byStatus[s] ?? 0;

    const beneficiaryRows = (await this.raffleNumberRepo
      .createQueryBuilder('rn')
      .leftJoin('rn.beneficiary', 'b')
      .select('rn.beneficiaryId', 'beneficiaryId')
      .addSelect(`TRIM(COALESCE(b.firstName, '') || ' ' || COALESCE(b.lastName, ''))`, 'fullName')
      .addSelect(`COUNT(*)`, 'cuponCnt')
      .addSelect(`SUM(CASE WHEN rn.status = :stSold THEN 1 ELSE 0 END)`, 'soldCnt')
      .where('rn.raffleId = :rid', { rid: raffleId })
      .andWhere('rn.beneficiaryId IS NOT NULL')
      .groupBy('rn.beneficiaryId')
      .addGroupBy('b.id')
      .addGroupBy('b.firstName')
      .addGroupBy('b.lastName')
      .setParameter('stSold', RaffleNumberStatus.SOLD)
      .getRawMany()) as {
      beneficiaryId: string;
      fullName: string;
      cuponCnt: string;
      soldCnt: string;
    }[];

    const numberAggRows = (await this.raffleNumberRepo
      .createQueryBuilder('rn')
      .select('rn.beneficiaryId', 'beneficiaryId')
      .addSelect(`ARRAY_AGG(rn.number ORDER BY rn.number)`, 'numbers')
      .where('rn.raffleId = :rid', { rid: raffleId })
      .andWhere('rn.beneficiaryId IS NOT NULL')
      .groupBy('rn.beneficiaryId')
      .getRawMany()) as { beneficiaryId: string; numbers: unknown }[];

    const numsByBeneficiary = new Map<string, number[]>(
      numberAggRows.map((r) => [r.beneficiaryId, parsePgNumberArray(r.numbers)]),
    );

    const byBeneficiary = beneficiaryRows.map((row) => {
      const assigned = parseInt(row.cuponCnt, 10) || 0;
      const sold = parseInt(row.soldCnt, 10) || 0;
      return {
        beneficiaryId: row.beneficiaryId,
        fullName: row.fullName || '',
        /** Total números en el cupón (todos los estados con protagonista = coincide con `numbers`). */
        assigned,
        sold,
        remaining: assigned - sold,
        moneyCollected: sold * pricePerNumber,
        scoutEarnings: sold * scoutEarningsPerNum,
        numbers: numsByBeneficiary.get(row.beneficiaryId) ?? [],
      };
    });

    return {
      total,
      available: pick(RaffleNumberStatus.AVAILABLE),
      assigned: pick(RaffleNumberStatus.ASSIGNED),
      reserved: pick(RaffleNumberStatus.RESERVED),
      sold: pick(RaffleNumberStatus.SOLD),
      notSold: pick(RaffleNumberStatus.NOT_SOLD),
      pricePerNumber,
      byBeneficiary,
    };
  }

  /** Varios UPDATE por chunk: solo filas aún `disponible`. */
  private async bulkAssignAvailableNumbers(raffleId: string, byBeneficiaryNums: Map<string, number[]>): Promise<number> {
    let assigned = 0;
    for (const [bid, nums] of byBeneficiaryNums) {
      const unique = [...new Set(nums)].filter((n) => Number.isFinite(n) && n >= 1);
      for (let i = 0; i < unique.length; i += BULK_UPDATE_CHUNK) {
        const chunk = unique.slice(i, i + BULK_UPDATE_CHUNK);
        const res = await this.raffleNumberRepo.update(
          { raffleId, number: In(chunk), status: RaffleNumberStatus.AVAILABLE },
          { beneficiaryId: bid, status: RaffleNumberStatus.ASSIGNED },
        );
        assigned += res.affected ?? 0;
      }
    }
    return assigned;
  }

  async assignByBlocks(raffleId: string, dto: AssignBlocksDto): Promise<{ assigned: number }> {
    const meta = await this.raffleRepo.findOne({
      where: { id: raffleId },
      select: ['id', 'totalNumbers'],
    });
    if (!meta) throw new NotFoundException('Rifa no encontrada');
    const total = meta.totalNumbers;
    const blockSize = dto.numbersPerBlock ?? Math.ceil(total / (dto.beneficiaryIds.length || 1));
    const rows = await this.raffleNumberRepo.find({
      where: { raffleId, status: RaffleNumberStatus.AVAILABLE },
      select: ['number'],
      order: { number: 'ASC' },
    });
    const numList = rows.map((n) => n.number);
    const byBeneficiary = new Map<string, number[]>();
    let idx = 0;
    for (const bid of dto.beneficiaryIds) {
      if (!byBeneficiary.has(bid)) byBeneficiary.set(bid, []);
      for (let i = 0; i < blockSize && idx < numList.length; i++) {
        byBeneficiary.get(bid)!.push(numList[idx++]);
      }
    }
    const assigned = await this.bulkAssignAvailableNumbers(raffleId, byBeneficiary);
    return { assigned };
  }

  async assignContinuous(raffleId: string, dto: AssignContinuousDto): Promise<{ assigned: number }> {
    const rows = await this.raffleNumberRepo.find({
      where: { raffleId, status: RaffleNumberStatus.AVAILABLE },
      select: ['number'],
      order: { number: 'ASC' },
    });
    const available = rows.map((n) => n.number);
    const byBeneficiary = new Map<string, number[]>();
    let from = 0;
    for (const { beneficiaryId, count } of dto.assignments) {
      const slice = available.slice(from, from + count);
      from += count;
      if (!byBeneficiary.has(beneficiaryId)) byBeneficiary.set(beneficiaryId, []);
      byBeneficiary.get(beneficiaryId)!.push(...slice);
    }
    const assigned = await this.bulkAssignAvailableNumbers(raffleId, byBeneficiary);
    return { assigned };
  }

  async assignRandom(raffleId: string, dto: AssignRandomDto): Promise<{ assigned: number }> {
    const rows = await this.raffleNumberRepo.find({
      where: { raffleId, status: RaffleNumberStatus.AVAILABLE },
      select: ['number'],
    });
    const ids = dto.beneficiaryIds;
    if (ids.length === 0 || rows.length === 0) return { assigned: 0 };
    const shuffled = rows.map((n) => n.number).sort(() => Math.random() - 0.5);
    const byBeneficiary = new Map<string, number[]>();
    ids.forEach((id) => byBeneficiary.set(id, []));
    const perPerson = Math.floor(shuffled.length / ids.length);
    for (let i = 0; i < ids.length; i++) {
      const start = i * perPerson;
      const end = i === ids.length - 1 ? shuffled.length : start + perPerson;
      const chunkNums = shuffled.slice(start, end);
      byBeneficiary.get(ids[i])!.push(...chunkNums);
    }
    const assigned = await this.bulkAssignAvailableNumbers(raffleId, byBeneficiary);
    return { assigned };
  }

  async assignByRanges(raffleId: string, dto: AssignRangesDto): Promise<{ assigned: number }> {
    const meta = await this.raffleRepo.findOne({
      where: { id: raffleId },
      select: ['id', 'totalNumbers'],
    });
    if (!meta) throw new NotFoundException('Rifa no encontrada');
    const nums = parseRanges(dto.ranges, meta.totalNumbers);
    if (nums.length === 0) throw new BadRequestException('No se interpretaron números válidos en "ranges"');
    let affected = 0;
    for (let i = 0; i < nums.length; i += BULK_UPDATE_CHUNK) {
      const slice = nums.slice(i, i + BULK_UPDATE_CHUNK);
      const res = await this.raffleNumberRepo.update(
        { raffleId, number: In(slice) },
        { beneficiaryId: dto.beneficiaryId, status: RaffleNumberStatus.ASSIGNED },
      );
      affected += res.affected ?? 0;
    }
    return { assigned: affected };
  }

  async setBulkStatus(raffleId: string, dto: BulkStatusDto): Promise<{ updated: number }> {
    const meta = await this.raffleRepo.findOne({
      where: { id: raffleId },
      select: ['id', 'totalNumbers', 'eventId'],
    });
    if (!meta) throw new NotFoundException('Rifa no encontrada');
    const nums = parseRanges(dto.ranges, meta.totalNumbers);
    if (nums.length === 0) throw new BadRequestException('No se interpretaron números válidos en "ranges"');
    const update: Partial<RaffleNumber> = { status: dto.status };
    if (dto.status === RaffleNumberStatus.SOLD && dto.soldTo !== undefined) {
      update.soldTo = dto.soldTo.trim() || null;
    } else if (dto.status !== RaffleNumberStatus.SOLD) {
      update.soldTo = null;
    }
    let affected = 0;
    for (let i = 0; i < nums.length; i += BULK_UPDATE_CHUNK) {
      const slice = nums.slice(i, i + BULK_UPDATE_CHUNK);
      const result = await this.raffleNumberRepo.update({ raffleId, number: In(slice) }, update);
      affected += result.affected ?? 0;
    }
    if (meta.eventId && affected > 0) await this.recalcRaffleEventIncome(meta.eventId);
    return { updated: affected };
  }

  async releaseUnsold(raffleId: string): Promise<{ released: number }> {
    const qb = await this.raffleNumberRepo
      .createQueryBuilder()
      .update(RaffleNumber)
      .set({ status: RaffleNumberStatus.AVAILABLE, beneficiaryId: null, soldTo: null })
      .where('raffleId = :raffleId', { raffleId })
      .andWhere('status IN (:...statuses)', {
        statuses: [RaffleNumberStatus.ASSIGNED, RaffleNumberStatus.RESERVED, RaffleNumberStatus.NOT_SOLD],
      });
    const result = await qb.execute();
    return { released: result.affected ?? 0 };
  }

  /** Export CSV: Protagonista, Número, Estado, Comprador — incluye todos los números (disponibles con protagonista vacío). */
  async getExportCsv(raffleId: string): Promise<string> {
    const raffle = await this.findOne(raffleId);
    const numbers = [...(raffle.numbers || [])].sort((a, b) => a.number - b.number);
    const header = 'Protagonista/Scout,Número,Estado,Comprador';
    const escape = (s: string) => {
      const t = String(s ?? '').replace(/"/g, '""');
      return t.includes(',') || t.includes('"') || t.includes('\n') ? `"${t}"` : t;
    };
    const rows = numbers.map((n) => {
      const beneficiary = (n as any).beneficiary;
      const fullName = beneficiary
        ? `${beneficiary.firstName} ${beneficiary.lastName}`.trim().replace(/\s+/g, ' ')
        : '';
      return [fullName, n.number, n.status, (n as any).soldTo ?? ''].map(escape).join(',');
    });
    return [header, ...rows].join('\r\n');
  }

  /**
   * Importa el mismo formato que exporta `getExportCsv`.
   * Transacción: si hay errores de validación, no se aplica ningún cambio.
   */
  async importFromCsv(raffleId: string, rawCsv: string): Promise<{ updated: number }> {
    const meta = await this.raffleRepo.findOne({
      where: { id: raffleId },
      select: ['id', 'eventId', 'totalNumbers'],
    });
    if (!meta) throw new NotFoundException('Rifa no encontrada');

    const beneficiaries = await this.beneficiaryRepo.find({ select: ['id', 'firstName', 'lastName'] });
    const byNameKey = new Map<string, string>();
    for (const b of beneficiaries) {
      const key = protagonistImportKey(`${b.firstName} ${b.lastName}`);
      if (!byNameKey.has(key)) byNameKey.set(key, b.id);
    }

    const lines = stripCsvBom(rawCsv)
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .map((l) => l.replace(/\s+$/, ''))
      .filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      throw new BadRequestException('CSV vacío o sin filas de datos (se espera cabecera y al menos una fila)');
    }

    const headerCells = parseCsvLine(lines[0]);
    const cols = detectImportCsvColumns(headerCells);
    if (!cols) {
      throw new BadRequestException(
        'No se reconoce la cabecera del CSV. Use las columnas: Protagonista/Scout, Número, Estado, Comprador',
      );
    }

    const indexNeed = [cols.numIdx, cols.estIdx];
    if (cols.protIdx >= 0) indexNeed.push(cols.protIdx);
    if (cols.comprIdx >= 0) indexNeed.push(cols.comprIdx);
    const minCells = Math.max(...indexNeed) + 1;

    const existingRows = await this.raffleNumberRepo.find({
      where: { raffleId },
      select: ['number', 'beneficiaryId'],
    });
    const byNumber = new Map(existingRows.map((r) => [r.number, r]));

    const errors: string[] = [];
    const seen = new Set<number>();
    type Op = { number: number; beneficiaryId: string | null; status: RaffleNumberStatus; soldTo: string | null };
    const ops: Op[] = [];

    for (let li = 1; li < lines.length; li++) {
      const lineNo = li + 1;
      const cells = parseCsvLine(lines[li]);
      if (cells.length < minCells) {
        errors.push(`Línea ${lineNo}: faltan columnas (se esperan al menos ${minCells})`);
        continue;
      }

      const protRaw = cols.protIdx >= 0 ? cells[cols.protIdx] ?? '' : '';
      const numRaw = cells[cols.numIdx];
      const estRaw = cells[cols.estIdx];
      const comprRaw = cols.comprIdx >= 0 ? cells[cols.comprIdx] ?? '' : '';

      const num = parseInt(String(numRaw).trim(), 10);
      if (!Number.isFinite(num) || num < 1) {
        errors.push(`Línea ${lineNo}: número de cupón inválido`);
        continue;
      }
      if (seen.has(num)) {
        errors.push(`Línea ${lineNo}: el número ${num} está repetido en el archivo`);
        continue;
      }
      seen.add(num);

      const rowMeta = byNumber.get(num);
      if (!rowMeta) {
        errors.push(`Línea ${lineNo}: el número ${num} no existe en esta rifa`);
        continue;
      }

      const status = parseImportStatus(estRaw);
      if (!status) {
        errors.push(
          `Línea ${lineNo}: estado desconocido "${estRaw.trim()}" (use: disponible, asignado, reservado, vendido, no_vendido)`,
        );
        continue;
      }

      let beneficiaryId: string | null;
      if (status === RaffleNumberStatus.AVAILABLE) {
        beneficiaryId = null;
      } else if (isEmptyProtagonistCell(protRaw)) {
        beneficiaryId = rowMeta.beneficiaryId;
        if (!beneficiaryId) {
          errors.push(
            `Línea ${lineNo}: falta protagonista para el estado "${estRaw.trim()}" (el número ${num} no tenía scout asignado)`,
          );
          continue;
        }
      } else {
        const bid = byNameKey.get(protagonistImportKey(protRaw));
        if (!bid) {
          errors.push(`Línea ${lineNo}: protagonista "${protRaw.trim()}" no coincide con ningún scout registrado`);
          continue;
        }
        beneficiaryId = bid;
      }

      const soldTo =
        status === RaffleNumberStatus.SOLD ? (comprRaw.trim().replace(/\s+/g, ' ') || null) : null;

      ops.push({ number: num, beneficiaryId, status, soldTo });
    }

    if (errors.length > 0) {
      const max = 25;
      const head = errors.slice(0, max);
      const more = errors.length > max ? `\n… y ${errors.length - max} error(es) más` : '';
      throw new BadRequestException(`Errores en el CSV:\n${head.join('\n')}${more}`);
    }

    if (ops.length === 0) throw new BadRequestException('No hay filas válidas para importar');

    await this.raffleNumberRepo.manager.transaction(async (em) => {
      const repo = em.getRepository(RaffleNumber);
      for (const op of ops) {
        await repo.update(
          { raffleId, number: op.number },
          { beneficiaryId: op.beneficiaryId, status: op.status, soldTo: op.soldTo },
        );
      }
    });

    if (meta.eventId) await this.recalcRaffleEventIncome(meta.eventId);
    return { updated: ops.length };
  }

  /** Sorteo: elige N ganadores al azar entre los números vendidos */
  async draw(raffleId: string, count: number): Promise<{ winners: { number: number; soldTo: string | null; beneficiaryName: string }[] }> {
    const raffle = await this.findOne(raffleId);
    const sold = (raffle.numbers || []).filter((n) => n.status === RaffleNumberStatus.SOLD);
    if (sold.length === 0) throw new BadRequestException('No hay números vendidos para sortear');
    const shuffled = sold.slice().sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));
    const winners = selected.map((n) => {
      const beneficiary = (n as any).beneficiary;
      const beneficiaryName = beneficiary ? `${beneficiary.firstName} ${beneficiary.lastName}` : '';
      return {
        number: n.number,
        soldTo: (n as any).soldTo ?? null,
        beneficiaryName,
      };
    });
    return { winners };
  }
}
