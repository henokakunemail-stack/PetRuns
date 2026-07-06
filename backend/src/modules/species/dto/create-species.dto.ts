import { IsString, MinLength } from 'class-validator';

export class CreateSpeciesDto {
  @IsString()
  @MinLength(2)
  name!: string;
}
