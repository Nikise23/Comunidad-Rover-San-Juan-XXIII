import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Event } from './event.entity';
import { Sale } from '../../sales/entities/sale.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  unit: string; // docena, unidad, número (rifa), etc.

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  pricePerUnit: number;

  /** Ganancia personal del scout por unidad vendida. Null = total (precio); número = monto fijo por unidad */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  scoutEarningsPerUnit: number | null;

  @Column({ type: 'int', default: 0, nullable: true })
  totalQuantity: number; // para rifas: cantidad total de números

  @Column({ type: 'uuid' })
  eventId: string;

  @ManyToOne(() => Event, (event) => event.products, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @OneToMany(() => Sale, (sale) => sale.product)
  sales: Sale[];
}
