import { IsInt, IsOptional, IsString, IsNumber, Min } from 'class-validator';

// ownerId sengaja TIDAK ada di sini — selalu diambil dari JWT user yang login,
// supaya tidak bisa membuat pet atas nama orang lain.
export class CreatePetDto {
  @IsString()
  @IsOptional()
  speciesId?: string;

  @IsString()
  @IsOptional()
  breedId?: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ageMonths?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weightKg?: number;

  @IsOptional()
  @IsString()
  temperamentNotes?: string;

  @IsOptional()
  @IsString()
  medicalNotes?: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
