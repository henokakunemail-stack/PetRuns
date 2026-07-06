import { IsEmail, IsString, MinLength, IsOptional, IsArray, IsIn } from 'class-validator';

const ALLOWED_ROLES = ['OWNER', 'WORKER'] as const;

export class RegisterDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsArray()
  @IsIn(ALLOWED_ROLES, { each: true })
  roles?: ('OWNER' | 'WORKER')[];
}
