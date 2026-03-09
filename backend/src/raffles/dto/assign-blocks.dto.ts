import { IsArray, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class AssignBlocksDto {
  @IsArray()
  @IsUUID('4', { each: true })
  beneficiaryIds: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  numbersPerBlock?: number; // ej. 10 → cada beneficiario recibe bloques de 10 (1-10, 11-20, ...)
}
