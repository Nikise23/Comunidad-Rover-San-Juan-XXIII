import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Event } from '../events/entities/event.entity';
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

@Injectable()
export class RafflesService {
  constructor(
    @InjectRepository(Raffle)
    private readonly raffleRepo: Repository<Raffle>,
    @InjectRepository(RaffleNumber)
    private readonly raffleNumberRepo: Repository<RaffleNumber>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
  ) {}

  /** Recalcula los ingresos del evento de tipo rifa según números vendidos (y actualiza event.income). */
  async recalcRaffleEventIncome(eventId: string): Promise<number> {
    const raffles = await this.raffleRepo.find({
      where: { eventId },
      relations: ['numbers'],
    });
    let total = 0;
    for (const r of raffles) {
      const price = Number(r.pricePerNumber) || 0;
      const sold = (r.numbers || []).filter((n) => n.status === RaffleNumberStatus.SOLD).length;
      total += sold * price;
    }
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

  async findAll(eventId?: string): Promise<Raffle[]> {
    const qb = this.raffleRepo.createQueryBuilder('r')
      .leftJoinAndSelect('r.event', 'event')
      .leftJoinAndSelect('r.numbers', 'numbers')
      .leftJoinAndSelect('numbers.beneficiary', 'beneficiary')
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
        for (let i = existing + 1; i <= dto.totalNumbers; i++) {
          await this.raffleNumberRepo.save(
            this.raffleNumberRepo.create({
              raffleId: id,
              number: i,
              status: RaffleNumberStatus.AVAILABLE,
            }),
          );
        }
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
    const raffle = await this.findOne(id);
    await this.raffleRepo.remove(raffle);
  }

  async assignNumber(raffleId: string, dto: AssignRaffleNumberDto): Promise<RaffleNumber> {
    const raffle = await this.findOne(raffleId);
    const rn = raffle.numbers?.find((n) => n.number === dto.number);
    if (!rn) throw new BadRequestException(`Número ${dto.number} no existe en esta rifa`);
    rn.beneficiaryId = dto.beneficiaryId ?? null;
    rn.status = dto.status ?? (dto.beneficiaryId ? RaffleNumberStatus.ASSIGNED : RaffleNumberStatus.AVAILABLE);
    const saved = await this.raffleNumberRepo.save(rn);
    if (raffle.eventId) await this.recalcRaffleEventIncome(raffle.eventId);
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

  async getRaffleSummary(raffleId: string): Promise<{
    total: number;
    available: number;
    assigned: number;
    reserved: number;
    sold: number;
    notSold: number;
    pricePerNumber: number;
    byBeneficiary: { beneficiaryId: string; fullName: string; assigned: number; sold: number; remaining: number; moneyCollected: number }[];
  }> {
    const raffle = await this.findOne(raffleId);
    const numbers = raffle.numbers || [];
    const pricePerNumber = Number(raffle.pricePerNumber) || 0;
    const available = numbers.filter((n) => n.status === RaffleNumberStatus.AVAILABLE).length;
    const assigned = numbers.filter((n) => n.status === RaffleNumberStatus.ASSIGNED).length;
    const reserved = numbers.filter((n) => n.status === RaffleNumberStatus.RESERVED).length;
    const sold = numbers.filter((n) => n.status === RaffleNumberStatus.SOLD).length;
    const notSold = numbers.filter((n) => n.status === RaffleNumberStatus.NOT_SOLD).length;
    const byBeneficiaryMap = new Map<string, { fullName: string; assigned: number; sold: number }>();
    numbers.forEach((n) => {
      if (n.beneficiaryId && n.beneficiary) {
        const key = n.beneficiaryId;
        const fullName = `${n.beneficiary.firstName} ${n.beneficiary.lastName}`;
        if (!byBeneficiaryMap.has(key)) {
          byBeneficiaryMap.set(key, { fullName, assigned: 0, sold: 0 });
        }
        const entry = byBeneficiaryMap.get(key)!;
        if (n.status === RaffleNumberStatus.ASSIGNED || n.status === RaffleNumberStatus.RESERVED) entry.assigned++;
        if (n.status === RaffleNumberStatus.SOLD) entry.sold++;
      }
    });
    const scoutEarningsPerNum = raffle.scoutEarningsPerNumber != null ? Number(raffle.scoutEarningsPerNumber) : pricePerNumber;
    const byBeneficiary = Array.from(byBeneficiaryMap.entries()).map(([beneficiaryId, v]) => ({
      beneficiaryId,
      fullName: v.fullName,
      assigned: v.assigned,
      sold: v.sold,
      remaining: v.assigned - v.sold,
      moneyCollected: v.sold * pricePerNumber,
      scoutEarnings: v.sold * scoutEarningsPerNum,
    }));
    return {
      total: numbers.length,
      available,
      assigned,
      reserved,
      sold,
      notSold,
      pricePerNumber,
      byBeneficiary,
    };
  }

  async assignByBlocks(raffleId: string, dto: AssignBlocksDto): Promise<{ assigned: number }> {
    const raffle = await this.findOne(raffleId);
    const total = raffle.totalNumbers;
    const blockSize = dto.numbersPerBlock ?? Math.ceil(total / (dto.beneficiaryIds.length || 1));
    const numbers = await this.raffleNumberRepo.find({
      where: { raffleId, status: RaffleNumberStatus.AVAILABLE },
      order: { number: 'ASC' },
    });
    const numList = numbers.map((n) => n.number);
    let assigned = 0;
    let idx = 0;
    for (const bid of dto.beneficiaryIds) {
      for (let i = 0; i < blockSize && idx < numList.length; i++) {
        const num = numList[idx++];
        const rn = numbers.find((n) => n.number === num);
        if (rn) {
          rn.beneficiaryId = bid;
          rn.status = RaffleNumberStatus.ASSIGNED;
          await this.raffleNumberRepo.save(rn);
          assigned++;
        }
      }
    }
    return { assigned };
  }

  async assignContinuous(raffleId: string, dto: AssignContinuousDto): Promise<{ assigned: number }> {
    const numbers = await this.raffleNumberRepo.find({
      where: { raffleId, status: RaffleNumberStatus.AVAILABLE },
      order: { number: 'ASC' },
    });
    const available = numbers.map((n) => n.number);
    let assigned = 0;
    let from = 0;
    for (const { beneficiaryId, count } of dto.assignments) {
      const slice = available.slice(from, from + count);
      from += count;
      for (const num of slice) {
        const rn = numbers.find((n) => n.number === num);
        if (rn) {
          rn.beneficiaryId = beneficiaryId;
          rn.status = RaffleNumberStatus.ASSIGNED;
          await this.raffleNumberRepo.save(rn);
          assigned++;
        }
      }
    }
    return { assigned };
  }

  async assignRandom(raffleId: string, dto: AssignRandomDto): Promise<{ assigned: number }> {
    const raffle = await this.findOne(raffleId);
    const numbers = await this.raffleNumberRepo.find({
      where: { raffleId, status: RaffleNumberStatus.AVAILABLE },
    });
    const ids = dto.beneficiaryIds;
    if (ids.length === 0 || numbers.length === 0) return { assigned: 0 };
    const shuffled = numbers.slice().sort(() => Math.random() - 0.5);
    const perPerson = Math.floor(shuffled.length / ids.length);
    let assigned = 0;
    for (let i = 0; i < ids.length; i++) {
      const start = i * perPerson;
      const end = i === ids.length - 1 ? shuffled.length : start + perPerson;
      for (let j = start; j < end; j++) {
        const rn = shuffled[j];
        rn.beneficiaryId = ids[i];
        rn.status = RaffleNumberStatus.ASSIGNED;
        await this.raffleNumberRepo.save(rn);
        assigned++;
      }
    }
    return { assigned };
  }

  async assignByRanges(raffleId: string, dto: AssignRangesDto): Promise<{ assigned: number }> {
    const raffle = await this.findOne(raffleId);
    const nums = parseRanges(dto.ranges, raffle.totalNumbers);
    if (nums.length === 0) throw new BadRequestException('No se interpretaron números válidos en "ranges"');
    const numbers = await this.raffleNumberRepo.find({
      where: { raffleId, number: In(nums) },
    });
    for (const rn of numbers) {
      rn.beneficiaryId = dto.beneficiaryId;
      rn.status = RaffleNumberStatus.ASSIGNED;
      await this.raffleNumberRepo.save(rn);
    }
    return { assigned: numbers.length };
  }

  async setBulkStatus(raffleId: string, dto: BulkStatusDto): Promise<{ updated: number }> {
    const raffle = await this.findOne(raffleId);
    const nums = parseRanges(dto.ranges, raffle.totalNumbers);
    if (nums.length === 0) throw new BadRequestException('No se interpretaron números válidos en "ranges"');
    const update: Partial<RaffleNumber> = { status: dto.status };
    if (dto.status === RaffleNumberStatus.SOLD && dto.soldTo !== undefined) {
      update.soldTo = dto.soldTo.trim() || null;
    } else if (dto.status !== RaffleNumberStatus.SOLD) {
      update.soldTo = null;
    }
    const result = await this.raffleNumberRepo.update(
      { raffleId, number: In(nums) },
      update,
    );
    if (raffle.eventId && (result.affected ?? 0) > 0) await this.recalcRaffleEventIncome(raffle.eventId);
    return { updated: result.affected ?? 0 };
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

  /** Export CSV: Protagonista, Número, Estado, Comprador */
  async getExportCsv(raffleId: string): Promise<string> {
    const raffle = await this.findOne(raffleId);
    const numbers = raffle.numbers || [];
    const header = 'Protagonista/Scout,Número,Estado,Comprador';
    const escape = (s: string) => {
      const t = String(s ?? '').replace(/"/g, '""');
      return t.includes(',') || t.includes('"') || t.includes('\n') ? `"${t}"` : t;
    };
    const rows = numbers
      .filter((n) => n.beneficiaryId != null)
      .map((n) => {
        const beneficiary = (n as any).beneficiary;
        const fullName = beneficiary ? `${beneficiary.firstName} ${beneficiary.lastName}` : 'Sin asignar';
        return [fullName, n.number, n.status, (n as any).soldTo ?? ''].map(escape).join(',');
      });
    return [header, ...rows].join('\r\n');
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
