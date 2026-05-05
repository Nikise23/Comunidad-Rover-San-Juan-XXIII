import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ImportSalesCsvDto {
  @IsUUID()
  eventId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5_000_000)
  csv: string;
}
