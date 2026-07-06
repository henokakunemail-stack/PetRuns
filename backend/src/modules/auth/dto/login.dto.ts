import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  /** Login key — accepts either email or phone. */
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
