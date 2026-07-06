import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  workerProfileId!: string;

  @IsUUID()
  petId!: string;

  /** ISO 8601 datetime, misal "2026-07-10T09:00:00.000Z" */
  @IsISO8601()
  scheduledStart!: string;

  @IsInt()
  @Min(15, { message: 'Durasi minimal 15 menit' })
  durationMinutes!: number;

  @IsOptional()
  @IsString()
  ownerNotes?: string;
}
