import { createHash } from 'crypto';

export interface MidtransSignatureInput {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  serverKey: string;
  signatureKey: string;
}

/**
 * Verifikasi signature notifikasi Midtrans.
 * Formula resmi: SHA512(order_id + status_code + gross_amount + server_key).
 * Pure function — logic keamanan kritikal, wajib unit test.
 */
export function verifyMidtransSignature(input: MidtransSignatureInput): boolean {
  const expected = createHash('sha512')
    .update(`${input.orderId}${input.statusCode}${input.grossAmount}${input.serverKey}`)
    .digest('hex');
  return expected === input.signatureKey;
}
