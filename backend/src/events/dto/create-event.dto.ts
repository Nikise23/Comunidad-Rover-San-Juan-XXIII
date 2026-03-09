import { IsString, IsNumber, IsOptional, IsUUID, IsDateString, Min } from 'class-validator';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsDateString()
  date: string;

  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsUUID()
  responsibleId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  income?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  expenses?: number;
}
