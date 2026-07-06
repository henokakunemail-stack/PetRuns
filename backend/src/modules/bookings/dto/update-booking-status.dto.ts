import { IsIn } from 'class-validator';
import { BookingStatus } from '../lib/booking-status.util';

const VALID_TARGET_STATUSES: BookingStatus[] = [
  'accepted',
  'rejected',
  'in_progress',
  'completed',
  'cancelled',
];

export class UpdateBookingStatusDto {
  @IsIn(VALID_TARGET_STATUSES, {
    message: `status harus salah satu dari: ${VALID_TARGET_STATUSES.join(', ')}`,
  })
  status!: BookingStatus;
}
