import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { Beneficiary } from '../../beneficiaries/entities/beneficiary.entity';
import { Product } from './product.entity';
import { Sale } from '../../sales/entities/sale.entity';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  type: string; // venta_empanadas, venta_pizzas, rifa, feria, venta_solidaria, etc.

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  income: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  expenses: number;

  @Column({ type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, (project) => project.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ type: 'uuid', nullable: true })
  responsibleId: string;

  @ManyToOne(() => Beneficiary, { nullable: true })
  @JoinColumn({ name: 'responsibleId' })
  responsible: Beneficiary;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Product, (product) => product.event)
  products: Product[];

  @OneToMany(() => Sale, (sale) => sale.event)
  sales: Sale[];
}
