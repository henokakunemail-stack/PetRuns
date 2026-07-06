import { IsInt, IsNumber, Min } from 'class-validator';

export class PricingEntryDto {
  @IsInt()
  @Min(15, { message: 'Durasi minimal 15 menit' })
  durationMinutes!: number;

  @IsNumber()
  @Min(0, { message: 'Harga tidak boleh negatif' })
  price!: number;
}
