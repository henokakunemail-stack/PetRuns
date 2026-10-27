import { IsString, MinLength } from 'class-validator';

export class UnregisterDeviceTokenDto {
  @IsString()
  @MinLength(20)
  token!: string;
}
