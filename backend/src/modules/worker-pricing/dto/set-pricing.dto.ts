import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, ValidateNested } from 'class-validator';
import { PricingEntryDto } from './pricing-entry.dto';

export class SetPricingDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PricingEntryDto)
  items!: PricingEntryDto[];
}
