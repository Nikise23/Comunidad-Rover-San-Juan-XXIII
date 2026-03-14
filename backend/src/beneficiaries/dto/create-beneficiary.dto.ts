import { IsString, IsOptional, IsArray, IsUUID, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

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
  @Transform(({ value }) => (value === undefined ? undefined : value === true || value === 'true'))
  @IsBoolean()
  documentationSubmitted?: boolean;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  projectIds?: string[];
}
