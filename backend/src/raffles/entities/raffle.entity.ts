import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Event } from '../../events/entities/event.entity';
import { RaffleNumber } from './raffle-number.entity';

@Entity('raffles')
export class Raffle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pricePerNumber: number;

  @Column({ type: 'int' })
  totalNumbers: number;

  /** Ganancia personal del scout por número vendido. Null = total (precio del número); si es número = monto fijo por número */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  scoutEarningsPerNumber: number | null;

  @Column({ type: 'uuid' })
  eventId: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => RaffleNumber, (rn) => rn.raffle)
  numbers: RaffleNumber[];
}
