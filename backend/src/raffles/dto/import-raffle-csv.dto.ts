import { IsString, MaxLength, MinLength } from 'class-validator';

export class ImportRaffleCsvDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5_000_000)
  csv: string;
}
