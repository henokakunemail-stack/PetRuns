import { IsOptional, IsString, IsNumber, Min, IsBoolean } from 'class-validator';

export class RegisterWorkerDto {
  @IsString()
  bio!: string;

  @IsOptional()
  @IsString()
  ktpDocumentUrl?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccountNumber?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.1, { message: 'Radius minimal 0.1 km' })
  serviceRadiusKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(-90, { message: 'Latitude harus antara -90 dan 90' })
  baseLatitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180, { message: 'Longitude harus antara -180 dan 180' })
  baseLongitude?: number;

  @IsOptional()
  @IsBoolean()
  skipProfileCreation?: boolean;
}
