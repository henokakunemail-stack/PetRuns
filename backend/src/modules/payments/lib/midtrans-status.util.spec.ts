import { mapMidtransTransactionStatus } from './midtrans-status.util';

describe('mapMidtransTransactionStatus', () => {
  it.each([
    ['capture', 'accept', 'paid'],
    ['capture', 'challenge', 'pending'],
    ['capture', undefined, 'pending'],
    ['settlement', undefined, 'paid'],
    ['pending', undefined, 'pending'],
    ['deny', undefined, 'failed'],
    ['cancel', undefined, 'failed'],
    ['expire', undefined, 'failed'],
    ['refund', undefined, 'refunded'],
    ['partial_refund', undefined, 'refunded'],
    ['status_tidak_dikenal', undefined, 'pending'],
  ] as const)('%s (fraud_status=%s) -> %s', (transactionStatus, fraudStatus, expected) => {
    expect(mapMidtransTransactionStatus(transactionStatus, fraudStatus)).toBe(expected);
  });
});
