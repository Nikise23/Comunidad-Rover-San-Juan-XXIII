import { IsString, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateContributionDto {
  @IsUUID()
  beneficiaryId: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
