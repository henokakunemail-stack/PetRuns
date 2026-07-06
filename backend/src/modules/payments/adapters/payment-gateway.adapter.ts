export interface CreateTransactionParams {
  orderId: string;
  grossAmount: number;
  customerName: string;
  customerEmail?: string;
}

export interface CreateTransactionResult {
  gatewayRef: string;
  redirectUrl: string;
}

export interface VerifyNotificationParams {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}

/**
 * Abstraksi payment gateway supaya domain logic (PaymentsService) tidak terikat
 * ke satu provider. Keputusan saat ini: Midtrans (lihat docs/EXECUTION_PLAN.md),
 * tapi bisa ganti provider tanpa ubah PaymentsService.
 */
export interface PaymentGatewayAdapter {
  createTransaction(params: CreateTransactionParams): Promise<CreateTransactionResult>;
  verifyNotificationSignature(params: VerifyNotificationParams): boolean;
}

export const PAYMENT_GATEWAY_ADAPTER = Symbol('PAYMENT_GATEWAY_ADAPTER');
