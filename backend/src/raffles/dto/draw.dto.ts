import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class DrawDto {
  /** Cantidad de ganadores a sortear */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  count: number;
}
