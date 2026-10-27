import crypto from 'crypto';
import { HttpError } from './otp.service.ts';

export interface PreAuthHoldResult {
  success: boolean;
  gatewayRef: string;
  orderId: string;
  grossAmount: number;
  authorizedAt: Date;
}

export interface VoidPreAuthResult {
  success: boolean;
  orderId: string;
  gatewayRef: string;
  releasedAt: Date;
}
export interface CapturePaymentResult {
  success: boolean;
  orderId: string;
  gatewayRef: string;
  capturedAmount: number;
  capturedAt: Date;
}

export interface PaymentGatewayClient {
  createPreAuthHold(orderId: string, grossAmount: number, token?: string): Promise<PreAuthHoldResult>;
  voidPreAuthHold(orderId: string, gatewayRef: string): Promise<VoidPreAuthResult>;
  capturePayment(orderId: string, gatewayRef: string, grossAmount: number): Promise<CapturePaymentResult>;
}

export class MockMidtransPaymentGateway implements PaymentGatewayClient {
  private voidedOrders = new Set<string>();
  private activeHolds = new Map<string, PreAuthHoldResult>();
  private capturedOrders = new Map<string, CapturePaymentResult>();
  private simulateDecline: boolean = false;

  setSimulateDecline(simulate: boolean): void {
    this.simulateDecline = simulate;
  }

  async createPreAuthHold(orderId: string, grossAmount: number, token?: string): Promise<PreAuthHoldResult> {
    if (this.simulateDecline || token === 'tok_declined') {
      throw new HttpError('Payment authorization failed: Card declined or insufficient funds', 402);
    }

    if (grossAmount <= 0) {
      throw new HttpError('Invalid gross amount for pre-authorization hold', 400);
    }

    const gatewayRef = `midtrans_hold_${crypto.randomBytes(8).toString('hex')}`;
    const result: PreAuthHoldResult = {
      success: true,
      gatewayRef,
      orderId,
      grossAmount,
      authorizedAt: new Date(),
    };

    this.activeHolds.set(orderId, result);
    return result;
  }

  async voidPreAuthHold(orderId: string, gatewayRef: string): Promise<VoidPreAuthResult> {
    if (!orderId || !gatewayRef) {
      throw new HttpError('Order ID and gateway reference are required to void pre-authorization hold', 400);
    }

    this.voidedOrders.add(orderId);
    this.activeHolds.delete(orderId);

    return {
      success: true,
      orderId,
      gatewayRef,
      releasedAt: new Date(),
    };
  }

  async capturePayment(orderId: string, gatewayRef: string, grossAmount: number): Promise<CapturePaymentResult> {
    if (!orderId || !gatewayRef) {
      throw new HttpError('Order ID and gateway reference are required to capture payment', 400);
    }
    if (grossAmount <= 0) {
      throw new HttpError('Captured amount must be greater than 0', 400);
    }
    this.activeHolds.delete(orderId);
    const result: CapturePaymentResult = {
      success: true,
      orderId,
      gatewayRef,
      capturedAmount: grossAmount,
      capturedAt: new Date(),
    };
    this.capturedOrders.set(orderId, result);
    return result;
  }

  isCaptured(orderId: string): boolean {
    return this.capturedOrders.has(orderId);
  }
  isVoided(orderId: string): boolean {
    return this.voidedOrders.has(orderId);
  }

  hasActiveHold(orderId: string): boolean {
    return this.activeHolds.has(orderId);
  }
}

export const paymentGatewayClient = new MockMidtransPaymentGateway();
