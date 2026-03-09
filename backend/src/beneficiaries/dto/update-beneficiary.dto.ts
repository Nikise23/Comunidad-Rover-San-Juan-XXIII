import { PartialType } from '@nestjs/mapped-types';
import { CreateBeneficiaryDto } from './create-beneficiary.dto';
import { IsOptional, IsArray, IsUUID } from 'class-validator';

export class UpdateBeneficiaryDto extends PartialType(CreateBeneficiaryDto) {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  projectIds?: string[];
}
