import { IsUUID, IsNumber, IsOptional, IsEnum } from 'class-validator';
import { RaffleNumberStatus } from '../entities/raffle-number.entity';

export class AssignRaffleNumberDto {
  @IsNumber()
  number: number;

  @IsOptional()
  @IsUUID()
  beneficiaryId?: string;

  @IsOptional()
  @IsEnum(RaffleNumberStatus)
  status?: RaffleNumberStatus;
}
