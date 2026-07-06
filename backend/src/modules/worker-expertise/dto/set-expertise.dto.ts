import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class SetExpertiseDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  speciesIds!: string[];
}
