import { IsString, IsNumber, IsUUID, Min, IsOptional, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRaffleDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  pricePerNumber: number;

  @IsNumber()
  @Min(1)
  totalNumbers: number;

  /** Ganancia del scout por número vendido. Null/omitido = total (precio del número); número = monto fijo por número */
  @IsOptional()
  @ValidateIf((o) => o.scoutEarningsPerNumber != null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  scoutEarningsPerNumber?: number | null;

  @IsUUID()
  eventId: string;
}
