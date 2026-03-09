import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { RaffleNumberStatus } from '../entities/raffle-number.entity';

export class BulkStatusDto {
  /** Números o rangos: "1-10", "15", "20-25" o "1-10, 15, 20-25" */
  @IsString()
  ranges: string;

  @IsEnum(RaffleNumberStatus)
  status: RaffleNumberStatus;

  /** Nombre del comprador (opcional; si status = vendido se aplica a todos los números del rango) */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  soldTo?: string;
}
