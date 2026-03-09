import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToMany,
  OneToMany,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { Sale } from '../../sales/entities/sale.entity';
import { RaffleNumber } from '../../raffles/entities/raffle-number.entity';

@Entity('beneficiaries')
export class Beneficiary {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ unique: true })
  dni: string;

  @Column({ nullable: true })
  contact: string;

  @Column({ nullable: true })
  role: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToMany(() => Project, (project) => project.beneficiaries)
  projects: Project[];

  @OneToMany(() => Sale, (sale) => sale.beneficiary)
  sales: Sale[];

  @OneToMany(() => RaffleNumber, (rn) => rn.beneficiary)
  raffleNumbers: RaffleNumber[];
}
