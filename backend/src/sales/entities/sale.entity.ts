import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Beneficiary } from '../../beneficiaries/entities/beneficiary.entity';
import { Event } from '../../events/entities/event.entity';
import { Product } from '../../events/entities/product.entity';

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  quantity: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  amount: number; // quantity * pricePerUnit (calculado o guardado)

  @Column({ type: 'uuid' })
  beneficiaryId: string;

  @ManyToOne(() => Beneficiary, (b) => b.sales, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'beneficiaryId' })
  beneficiary: Beneficiary;

  @Column({ type: 'uuid' })
  eventId: string;

  @ManyToOne(() => Event, (e) => e.sales, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column({ type: 'uuid' })
  productId: string;

  @ManyToOne(() => Product, (p) => p.sales, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'productId' })
  product: Product;

  @CreateDateColumn()
  createdAt: Date;
}
