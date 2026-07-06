import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { verifyMidtransSignature } from '../lib/midtrans-signature.util';
import {
  CreateTransactionParams,
  CreateTransactionResult,
  PaymentGatewayAdapter,
  VerifyNotificationParams,
} from './payment-gateway.adapter';

interface MidtransSnapResponse {
  token: string;
  redirect_url: string;
}

@Injectable()
export class MidtransPaymentAdapter implements PaymentGatewayAdapter {
  constructor(private readonly config: ConfigService) {}

  private get serverKey(): string {
    const key = this.config.get<string>('MIDTRANS_SERVER_KEY');
    if (!key) {
      throw new Error('MIDTRANS_SERVER_KEY belum diset di environment');
    }
    return key;
  }

  private get snapBaseUrl(): string {
    const isProduction = this.config.get<string>('MIDTRANS_IS_PRODUCTION') === 'true';
    return isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';
  }

  async createTransaction(params: CreateTransactionParams): Promise<CreateTransactionResult> {
    const auth = Buffer.from(`${this.serverKey}:`).toString('base64');

    const response = await fetch(this.snapBaseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: params.orderId,
          gross_amount: Math.round(params.grossAmount),
        },
        customer_details: {
          first_name: params.customerName,
          email: params.customerEmail,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Midtrans createTransaction gagal (HTTP ${response.status}): ${body}`);
    }

    const data = (await response.json()) as MidtransSnapResponse;
    return { gatewayRef: data.token, redirectUrl: data.redirect_url };
  }

  verifyNotificationSignature(params: VerifyNotificationParams): boolean {
    return verifyMidtransSignature({
      orderId: params.orderId,
      statusCode: params.statusCode,
      grossAmount: params.grossAmount,
      signatureKey: params.signatureKey,
      serverKey: this.serverKey,
    });
  }
}
