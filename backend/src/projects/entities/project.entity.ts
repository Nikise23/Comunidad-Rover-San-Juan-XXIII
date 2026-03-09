import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';
import { Event } from '../../events/entities/event.entity';
import { Beneficiary } from '../../beneficiaries/entities/beneficiary.entity';

export enum ProjectStatus {
  ACTIVE = 'activo',
  FINISHED = 'finalizado',
}

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  budgetTarget: number;

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ type: 'enum', enum: ProjectStatus, default: ProjectStatus.ACTIVE })
  status: ProjectStatus;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Event, (event) => event.project)
  events: Event[];

  @ManyToMany(() => Beneficiary, (b) => b.projects)
  @JoinTable({
    name: 'project_beneficiaries',
    joinColumn: { name: 'project_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'beneficiary_id', referencedColumnName: 'id' },
  })
  beneficiaries: Beneficiary[];
}
