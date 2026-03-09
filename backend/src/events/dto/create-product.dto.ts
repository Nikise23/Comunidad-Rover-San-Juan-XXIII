import { IsString, IsNumber, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsNumber()
  @Min(0)
  pricePerUnit: number;

  /** Ganancia del scout por unidad. Null/omitido = total (precio); número = monto fijo por unidad */
  @IsOptional()
  @ValidateIf((o) => o.scoutEarningsPerUnit != null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  scoutEarningsPerUnit?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalQuantity?: number;

  @IsUUID()
  eventId: string;
}
