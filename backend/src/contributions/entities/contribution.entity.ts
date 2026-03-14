import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Beneficiary } from '../../beneficiaries/entities/beneficiary.entity';
import { Project } from '../../projects/entities/project.entity';

@Entity('contributions')
export class Contribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  beneficiaryId: string;

  @ManyToOne(() => Beneficiary, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'beneficiaryId' })
  beneficiary: Beneficiary;

  @Column({ type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'date', nullable: true })
  date: Date;

  @Column({ type: 'text', nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;
}
