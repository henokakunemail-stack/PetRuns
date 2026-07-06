export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

/**
 * Map transaction_status (+ fraud_status untuk kasus 'capture') dari notifikasi
 * Midtrans ke status internal Payment kita.
 * Pure function — wajib unit test karena menentukan apakah booking dianggap lunas.
 */
export function mapMidtransTransactionStatus(
  transactionStatus: string,
  fraudStatus?: string,
): PaymentStatus {
  switch (transactionStatus) {
    case 'capture':
      return fraudStatus === 'accept' ? 'paid' : 'pending';
    case 'settlement':
      return 'paid';
    case 'pending':
      return 'pending';
    case 'deny':
    case 'cancel':
    case 'expire':
      return 'failed';
    case 'refund':
    case 'partial_refund':
      return 'refunded';
    default:
      return 'pending';
  }
}
