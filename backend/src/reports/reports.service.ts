import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Project } from '../projects/entities/project.entity';
import { Event } from '../events/entities/event.entity';
import { Sale } from '../sales/entities/sale.entity';
import { Product } from '../events/entities/product.entity';
import { Beneficiary } from '../beneficiaries/entities/beneficiary.entity';
import { Raffle } from '../raffles/entities/raffle.entity';
import { RaffleNumber, RaffleNumberStatus } from '../raffles/entities/raffle-number.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(Sale)
    private readonly saleRepo: Repository<Sale>,
    @InjectRepository(Beneficiary)
    private readonly beneficiaryRepo: Repository<Beneficiary>,
    @InjectRepository(Raffle)
    private readonly raffleRepo: Repository<Raffle>,
    @InjectRepository(RaffleNumber)
    private readonly raffleNumberRepo: Repository<RaffleNumber>,
  ) {}

  async getDashboard(projectId?: string): Promise<{
    projects: { id: string; name: string; budgetTarget: number; totalRaised: number; progressPercent: number; eventsCount: number; status: string }[];
    recentEvents: { id: string; name: string; type: string; date: string; income: number; expenses: number; netProfit: number }[];
    beneficiaryRanking: { beneficiaryId: string; fullName: string; total: number }[];
    scoutRaffleEarnings: { beneficiaryId: string; fullName: string; totalScoutEarnings: number; byEvent: { eventId: string; eventName: string; scoutEarnings: number }[] }[];
    evolution: { label: string; total: number }[];
  }> {
    const projects = await this.projectRepo.find({
      relations: ['events'],
      order: { createdAt: 'DESC' },
      where: projectId ? { id: projectId } : undefined,
    });

    const projectStats = await Promise.all(
      projects.map(async (p) => {
        const events = await this.eventRepo.find({ where: { projectId: p.id } });
        const totalRaised = events.reduce((sum, e) => sum + Number(e.income), 0);
        const budgetTarget = Number(p.budgetTarget) || 1;
        const progressPercent = Math.min(100, Math.round((totalRaised / budgetTarget) * 100));
        return {
          id: p.id,
          name: p.name,
          budgetTarget,
          totalRaised,
          progressPercent,
          eventsCount: events.length,
          status: p.status,
        };
      }),
    );

    const eventQb = this.eventRepo
      .createQueryBuilder('e')
      .orderBy('e.date', 'DESC')
      .limit(10);
    if (projectId) eventQb.andWhere('e.projectId = :projectId', { projectId });
    const recentEventsRaw = await eventQb.getMany();

    // Para eventos tipo rifa: ingresos = suma (números vendidos × precio); ganancias = suma ganancia personal por número
    const soldNumbersForRaffle = await this.raffleNumberRepo.find({
      where: { status: RaffleNumberStatus.SOLD },
      relations: ['raffle'],
    });
    const eventRaffleStats = new Map<string, { income: number; scoutEarnings: number }>();
    soldNumbersForRaffle.forEach((n) => {
      const raffle = n.raffle as Raffle;
      if (!raffle) return;
      const eventId = raffle.eventId;
      const pricePerNumber = Number(raffle.pricePerNumber) || 0;
      const scoutPerNum = raffle.scoutEarningsPerNumber != null ? Number(raffle.scoutEarningsPerNumber) : pricePerNumber;
      if (!eventRaffleStats.has(eventId)) eventRaffleStats.set(eventId, { income: 0, scoutEarnings: 0 });
      const st = eventRaffleStats.get(eventId)!;
      st.income += pricePerNumber;
      st.scoutEarnings += scoutPerNum;
    });

    const recentEvents = recentEventsRaw.map((e) => {
      const d = e.date as Date | string;
      const dateStr = d instanceof Date ? d.toISOString().split('T')[0] : String(d).slice(0, 10);
      const isRaffle = String(e.type).toLowerCase() === 'rifa';
      const raffleStats = isRaffle ? eventRaffleStats.get(e.id) : null;
      const income = isRaffle ? (raffleStats?.income ?? 0) : Number(e.income);
      const expenses = Number(e.expenses);
      const netProfit = isRaffle ? (raffleStats?.scoutEarnings ?? 0) : Number(e.income) - expenses;
      return {
        id: e.id,
        name: e.name,
        type: e.type,
        date: dateStr,
        income,
        expenses,
        netProfit,
      };
    });

    const rankingQb = this.saleRepo
      .createQueryBuilder('s')
      .select('s.beneficiaryId', 'beneficiaryId')
      .addSelect('SUM(s.amount)', 'total')
      .groupBy('s.beneficiaryId')
      .orderBy('total', 'DESC')
      .limit(10);
    if (projectId) {
      rankingQb.innerJoin('s.event', 'ev').andWhere('ev.projectId = :projectId', { projectId });
    }
    const rankingRows = await rankingQb.getRawMany();
    const beneficiaryIds = rankingRows.map((r) => r.beneficiaryId).filter(Boolean);
    const beneficiaries = beneficiaryIds.length
      ? await this.beneficiaryRepo.find({
          where: { id: In(beneficiaryIds) },
          select: ['id', 'firstName', 'lastName'],
        })
      : [];
    const nameMap = new Map(beneficiaries.map((b) => [b.id, `${b.firstName} ${b.lastName}`]));
    const beneficiaryRanking = rankingRows.map((r) => ({
      beneficiaryId: r.beneficiaryId,
      fullName: nameMap.get(r.beneficiaryId) || 'Sin nombre',
      total: parseFloat(r.total || '0'),
    }));

    const evolutionQb = this.eventRepo
      .createQueryBuilder('e')
      .select("to_char(e.date, 'YYYY-MM')", 'month')
      .addSelect('SUM(e.income)', 'total')
      .groupBy("to_char(e.date, 'YYYY-MM')")
      .orderBy('month', 'ASC')
      .limit(12);
    if (projectId) evolutionQb.andWhere('e.projectId = :projectId', { projectId });
    const evolutionRows = await evolutionQb.getRawMany();
    const evolution = evolutionRows.map((r) => ({
      label: r.month,
      total: parseFloat(r.total || '0'),
    }));

    type ScoutEntry = { total: number; byEvent: Map<string, { eventName: string; scoutEarnings: number }> };
    const scoutEarningsMap = new Map<string, ScoutEntry>();

    // 1) Ganancias por rifas (por evento)
    const soldNumbers = await this.raffleNumberRepo.find({
      where: { status: RaffleNumberStatus.SOLD },
      relations: ['raffle', 'raffle.event', 'beneficiary'],
    });
    soldNumbers.forEach((n) => {
      if (!n.beneficiaryId || !n.raffle) return;
      const raffle = n.raffle as Raffle & { event?: { id: string; name: string } };
      const eventId = raffle.eventId;
      const eventName = raffle.event?.name ?? 'Evento';
      const pricePerNumber = Number(raffle.pricePerNumber) || 0;
      const scoutPerNum = raffle.scoutEarningsPerNumber != null ? Number(raffle.scoutEarningsPerNumber) : pricePerNumber;
      if (!scoutEarningsMap.has(n.beneficiaryId)) {
        scoutEarningsMap.set(n.beneficiaryId, { total: 0, byEvent: new Map() });
      }
      const entry = scoutEarningsMap.get(n.beneficiaryId)!;
      entry.total += scoutPerNum;
      const ev = entry.byEvent.get(eventId);
      if (!ev) entry.byEvent.set(eventId, { eventName, scoutEarnings: scoutPerNum });
      else ev.scoutEarnings += scoutPerNum;
    });

    // 2) Ganancias por ventas de otros eventos (empanadas, etc.): ganancia = cantidad * (scoutEarningsPerUnit ?? pricePerUnit)
    const salesWithProduct = await this.saleRepo.find({
      relations: ['product', 'event'],
      where: {},
    });
    salesWithProduct.forEach((s) => {
      if (!s.beneficiaryId || !s.product) return;
      const product = s.product as Product;
      const pricePerUnit = Number(product.pricePerUnit) || 0;
      const scoutPerUnit = product.scoutEarningsPerUnit;
      const earningsPerUnit = scoutPerUnit != null ? Number(scoutPerUnit) : pricePerUnit;
      const scoutEarnings = (Number(s.quantity) || 0) * earningsPerUnit;
      if (scoutEarnings <= 0) return;
      const eventId = s.eventId;
      const eventName = (s.event as { name?: string } | null)?.name ?? 'Evento';
      if (!scoutEarningsMap.has(s.beneficiaryId)) {
        scoutEarningsMap.set(s.beneficiaryId, { total: 0, byEvent: new Map() });
      }
      const entry = scoutEarningsMap.get(s.beneficiaryId)!;
      entry.total += scoutEarnings;
      const ev = entry.byEvent.get(eventId);
      if (!ev) entry.byEvent.set(eventId, { eventName, scoutEarnings });
      else ev.scoutEarnings += scoutEarnings;
    });

    const scoutBeneficiaryIds = Array.from(scoutEarningsMap.keys());
    const scoutBeneficiaries = scoutBeneficiaryIds.length
      ? await this.beneficiaryRepo.find({
          where: { id: In(scoutBeneficiaryIds) },
          select: ['id', 'firstName', 'lastName'],
        })
      : [];
    const scoutNameMap = new Map(scoutBeneficiaries.map((b) => [b.id, `${b.firstName} ${b.lastName}`]));
    const scoutRaffleEarnings = Array.from(scoutEarningsMap.entries())
      .map(([beneficiaryId, entry]) => ({
        beneficiaryId,
        fullName: scoutNameMap.get(beneficiaryId) || 'Sin nombre',
        totalScoutEarnings: entry.total,
        byEvent: Array.from(entry.byEvent.entries())
          .map(([eventId, v]) => ({ eventId, eventName: v.eventName, scoutEarnings: v.scoutEarnings }))
          .sort((a, b) => a.eventName.localeCompare(b.eventName)),
      }))
      .sort((a, b) => b.totalScoutEarnings - a.totalScoutEarnings);

    return {
      projects: projectStats,
      recentEvents,
      beneficiaryRanking,
      scoutRaffleEarnings,
      evolution,
    };
  }

  async getProjectFinancialSummary(projectId: string): Promise<{
    totalRaised: number;
    budgetTarget: number;
    progressPercent: number;
    eventsCount: number;
    incomeByEvent: { eventId: string; eventName: string; income: number; expenses: number; net: number }[];
    beneficiaryRanking: { beneficiaryId: string; fullName: string; total: number }[];
  }> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const events = await this.eventRepo.find({
      where: { projectId },
      order: { date: 'DESC' },
    });
    const totalRaised = events.reduce((sum, e) => sum + Number(e.income), 0);
    const budgetTarget = Number(project.budgetTarget) || 1;
    const progressPercent = Math.min(100, Math.round((totalRaised / budgetTarget) * 100));

    const incomeByEvent = events.map((e) => ({
      eventId: e.id,
      eventName: e.name,
      income: Number(e.income),
      expenses: Number(e.expenses),
      net: Number(e.income) - Number(e.expenses),
    }));

    const rankingRows = await this.saleRepo
      .createQueryBuilder('s')
      .select('s.beneficiaryId', 'beneficiaryId')
      .addSelect('SUM(s.amount)', 'total')
      .innerJoin('s.event', 'ev')
      .where('ev.projectId = :projectId', { projectId })
      .groupBy('s.beneficiaryId')
      .orderBy('total', 'DESC')
      .getRawMany();
    const bIds = rankingRows.map((r) => r.beneficiaryId).filter(Boolean);
    const bens = bIds.length
      ? await this.beneficiaryRepo.find({
          where: { id: In(bIds) },
          select: ['id', 'firstName', 'lastName'],
        })
      : [];
    const nameMap = new Map(bens.map((b) => [b.id, `${b.firstName} ${b.lastName}`]));
    const beneficiaryRanking = rankingRows.map((r) => ({
      beneficiaryId: r.beneficiaryId,
      fullName: nameMap.get(r.beneficiaryId) || 'Sin nombre',
      total: parseFloat(r.total || '0'),
    }));

    return {
      totalRaised,
      budgetTarget,
      progressPercent,
      eventsCount: events.length,
      incomeByEvent,
      beneficiaryRanking,
    };
  }

  /** Ranking de scouts por rifas vendidas en un evento (solo rifas de ese evento) */
  async getEventRaffleRanking(eventId: string): Promise<{ beneficiaryId: string; fullName: string; totalSold: number; scoutEarnings: number }[]> {
    const soldNumbers = await this.raffleNumberRepo.find({
      where: { status: RaffleNumberStatus.SOLD },
      relations: ['raffle', 'beneficiary'],
    });
    const byBeneficiary = new Map<string, { totalSold: number; scoutEarnings: number }>();
    soldNumbers.forEach((n) => {
      const raffle = n.raffle as Raffle;
      if (raffle.eventId !== eventId) return;
      if (!n.beneficiaryId) return;
      const scoutPerNum = raffle.scoutEarningsPerNumber != null ? Number(raffle.scoutEarningsPerNumber) : Number(raffle.pricePerNumber) || 0;
      if (!byBeneficiary.has(n.beneficiaryId)) byBeneficiary.set(n.beneficiaryId, { totalSold: 0, scoutEarnings: 0 });
      const e = byBeneficiary.get(n.beneficiaryId)!;
      e.totalSold += 1;
      e.scoutEarnings += scoutPerNum;
    });
    const bIds = Array.from(byBeneficiary.keys());
    const bens = bIds.length ? await this.beneficiaryRepo.find({ where: { id: In(bIds) }, select: ['id', 'firstName', 'lastName'] }) : [];
    const nameMap = new Map(bens.map((b) => [b.id, `${b.firstName} ${b.lastName}`]));
    return Array.from(byBeneficiary.entries())
      .map(([beneficiaryId, v]) => ({
        beneficiaryId,
        fullName: nameMap.get(beneficiaryId) || 'Sin nombre',
        totalSold: v.totalSold,
        scoutEarnings: v.scoutEarnings,
      }))
      .sort((a, b) => b.scoutEarnings - a.scoutEarnings);
  }
}
