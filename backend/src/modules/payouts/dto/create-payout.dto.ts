import { IsNumber, IsPositive, IsUUID } from 'class-validator';

export class CreatePayoutDto {
  @IsUUID()
  workerProfileId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;
}
