import { IsArray, IsNumber, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class AssignmentItem {
  @IsUUID()
  beneficiaryId: string;

  @IsNumber()
  @Min(1)
  count: number;
}

export class AssignContinuousDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentItem)
  assignments: AssignmentItem[]; // [{ beneficiaryId, count }, ...] → asigna consecutivos a cada uno
}
