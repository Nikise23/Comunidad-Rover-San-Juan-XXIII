import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RaffleNumberStatus } from '../entities/raffle-number.entity';

export class SetNumberStatusDto {
  @IsEnum(RaffleNumberStatus)
  status: RaffleNumberStatus;

  /** Nombre del comprador (opcional cuando status = vendido) */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  soldTo?: string;
}
