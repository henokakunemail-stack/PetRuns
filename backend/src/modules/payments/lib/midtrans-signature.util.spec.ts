import { createHash } from 'crypto';
import { verifyMidtransSignature } from './midtrans-signature.util';

function computeSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
) {
  return createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');
}

describe('verifyMidtransSignature', () => {
  const serverKey = 'SB-Mid-server-abc123';
  const orderId = 'booking-1';
  const statusCode = '200';
  const grossAmount = '150000.00';

  it('menerima signature yang valid', () => {
    const signatureKey = computeSignature(orderId, statusCode, grossAmount, serverKey);

    expect(
      verifyMidtransSignature({ orderId, statusCode, grossAmount, serverKey, signatureKey }),
    ).toBe(true);
  });

  it('menolak signature yang salah', () => {
    expect(
      verifyMidtransSignature({
        orderId,
        statusCode,
        grossAmount,
        serverKey,
        signatureKey: 'signature-palsu',
      }),
    ).toBe(false);
  });

  it('menolak kalau salah satu field notifikasi dipalsukan (gross_amount beda)', () => {
    const signatureKey = computeSignature(orderId, statusCode, grossAmount, serverKey);

    expect(
      verifyMidtransSignature({
        orderId,
        statusCode,
        grossAmount: '1.00', // gross_amount dimanipulasi, tapi signature masih untuk 150000.00
        serverKey,
        signatureKey,
      }),
    ).toBe(false);
  });
});
