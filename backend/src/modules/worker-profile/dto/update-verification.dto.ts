import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateVerificationDto {
  @IsIn(['approved', 'rejected'], {
    message: 'status harus "approved" atau "rejected"',
  })
  status!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  adminNote?: string;
}
