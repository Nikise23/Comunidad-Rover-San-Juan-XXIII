import { IsString, IsOptional, IsArray, IsUUID } from 'class-validator';

export class CreateBeneficiaryDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsString()
  dni: string;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  projectIds?: string[];
}
