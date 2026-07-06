import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { AvailabilityEntryDto } from './availability-entry.dto';

export class SetAvailabilityDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityEntryDto)
  items!: AvailabilityEntryDto[];
}
