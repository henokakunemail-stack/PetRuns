import { IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  profilePhotoUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(-90, { message: 'Latitude harus antara -90 hingga 90' })
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180, { message: 'Longitude harus antara -180 hingga 180' })
  longitude?: number;
}
