import { IsArray, IsUUID } from 'class-validator';

export class AssignRandomDto {
  @IsArray()
  @IsUUID('4', { each: true })
  beneficiaryIds: string[]; // reparte todos los disponibles en partes iguales al azar
}
