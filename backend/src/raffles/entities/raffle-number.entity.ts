import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Raffle } from './raffle.entity';
import { Beneficiary } from '../../beneficiaries/entities/beneficiary.entity';

export enum RaffleNumberStatus {
  AVAILABLE = 'disponible',
  ASSIGNED = 'asignado',
  RESERVED = 'reservado',
  SOLD = 'vendido',
  NOT_SOLD = 'no_vendido',
}

@Entity('raffle_numbers')
export class RaffleNumber {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int' })
  number: number; // número de la rifa (ej: 1 a 100)

  @Column({ type: 'varchar', length: 20, default: RaffleNumberStatus.AVAILABLE })
  status: RaffleNumberStatus;

  @Column({ type: 'uuid' })
  raffleId: string;

  @ManyToOne(() => Raffle, (r) => r.numbers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'raffleId' })
  raffle: Raffle;

  @Column({ type: 'uuid', nullable: true })
  beneficiaryId: string | null;

  /** Nombre de la persona que compró (cuando status = vendido) */
  @Column({ type: 'varchar', length: 200, nullable: true })
  soldTo: string | null;

  @ManyToOne(() => Beneficiary, (b) => b.raffleNumbers, { nullable: true })
  @JoinColumn({ name: 'beneficiaryId' })
  beneficiary: Beneficiary;
}
