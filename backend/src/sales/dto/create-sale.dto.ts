import { IsNumber, IsUUID, Min } from 'class-validator';

export class CreateSaleDto {
  @IsNumber()
  @Min(0)
  quantity: number;

  @IsUUID()
  beneficiaryId: string;

  @IsUUID()
  eventId: string;

  @IsUUID()
  productId: string;
}
