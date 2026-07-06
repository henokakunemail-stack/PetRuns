/**
 * Payload notifikasi webhook Midtrans. Dideklarasikan sebagai interface (bukan class
 * class-validator) supaya ValidationPipe global (forbidNonWhitelisted: true) tidak
 * menolak field-field lain yang dikirim Midtrans tapi tidak kita pakai.
 */
export interface MidtransNotificationPayload {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  transaction_id?: string;
  [key: string]: unknown;
}
