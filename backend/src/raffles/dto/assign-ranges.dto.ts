import { IsString, IsUUID } from 'class-validator';

export class AssignRangesDto {
  @IsUUID()
  beneficiaryId: string;

  /** Especificación de números: "1-10", "15", "20-25" o "1-10, 15, 20-25" */
  @IsString()
  ranges: string;
}
