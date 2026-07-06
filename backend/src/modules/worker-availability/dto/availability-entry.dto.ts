import { IsInt, IsString, Matches } from 'class-validator';
import { Min, Max } from 'class-validator';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class AvailabilityEntryDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  @Matches(TIME_REGEX, { message: 'startTime harus berformat HH:mm' })
  startTime!: string;

  @IsString()
  @Matches(TIME_REGEX, { message: 'endTime harus berformat HH:mm' })
  endTime!: string;
}
