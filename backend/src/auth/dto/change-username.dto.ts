import { IsString, MinLength } from 'class-validator';

export class ChangeUsernameDto {
  @IsString()
  @MinLength(3)
  newUsername!: string;

  @IsString()
  @MinLength(1)
  currentPassword!: string;
}
