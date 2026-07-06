import { IsString, IsUUID } from 'class-validator';

export class CreateBreedDto {
  @IsUUID()
  speciesId!: string;

  @IsString()
  name!: string;
}
