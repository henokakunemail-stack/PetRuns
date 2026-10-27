import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDeviceTokenDto } from './dto/register-device-token.dto';

type FirebaseAdmin = typeof import('firebase-admin');

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private firebase: FirebaseAdmin | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.initFirebase();
  }

  async registerDeviceToken(userId: string, dto: RegisterDeviceTokenDto): Promise<void> {
    await this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: {
        userId,
        token: dto.token,
        platform: dto.platform,
        app: dto.app,
      },
      update: {
        userId,
        platform: dto.platform,
        app: dto.app,
      },
    });
  }

  async unregisterDeviceToken(userId: string, token: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({ where: { userId, token } });
  }

  async notifyUser(userId: string, payload: NotificationPayload): Promise<void> {
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });
    await this.sendToTokens(
      tokens.map((t) => t.token),
      payload,
    );
  }

  async notifyWorkerNewBooking(workerUserId: string, bookingId: string): Promise<void> {
    await this.notifyUser(workerUserId, {
      title: 'Booking baru',
      body: 'Ada permintaan booking baru yang perlu Anda respon.',
      data: { type: 'booking_created', bookingId },
    });
  }

  async notifyOwnerBookingStatus(
    ownerId: string,
    bookingId: string,
    status: string,
  ): Promise<void> {
    const labels: Record<string, string> = {
      accepted: 'Booking Anda diterima.',
      rejected: 'Booking Anda ditolak.',
      in_progress: 'Sesi jalan-jalan dimulai.',
      completed: 'Sesi selesai. Beri rating untuk worker Anda.',
      cancelled: 'Booking Anda dibatalkan.',
    };

    await this.notifyUser(ownerId, {
      title: 'Update booking',
      body: labels[status] ?? `Status booking berubah menjadi ${status}.`,
      data: { type: 'booking_status_changed', bookingId, status },
    });
  }

  private async sendToTokens(tokens: string[], payload: NotificationPayload): Promise<void> {
    if (tokens.length === 0) return;
    if (!this.firebase) {
      this.logger.warn('Firebase belum dikonfigurasi; push notification dilewati');
      return;
    }

    try {
      const messaging = this.firebase.messaging();
      const result = await messaging.sendEachForMulticast({
        tokens,
        notification: { title: payload.title, body: payload.body },
        data: payload.data,
      });

      const invalidTokens = result.responses
        .map((response, index) => ({ response, token: tokens[index] }))
        .filter(({ response }) => {
          const code = response.error?.code;
          return code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token';
        })
        .map(({ token }) => token);

      if (invalidTokens.length > 0) {
        await this.prisma.deviceToken.deleteMany({ where: { token: { in: invalidTokens } } });
      }
    } catch (err) {
      this.logger.error('Gagal mengirim push notification', err);
    }
  }

  private async initFirebase(): Promise<void> {
    const serviceAccount = this.readServiceAccount();
    if (!serviceAccount) {
      this.logger.warn(
        'Firebase service account belum diset; endpoint token aktif tapi push notification tidak dikirim',
      );
      return;
    }

    const firebase = await import('firebase-admin');
    if (firebase.apps.length === 0) {
      firebase.initializeApp({
        credential: firebase.credential.cert(serviceAccount),
      });
    }
    this.firebase = firebase;
  }

  private readServiceAccount(): Record<string, string> | null {
    const json = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    const base64 = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_BASE64');
    const raw = json ?? (base64 ? Buffer.from(base64, 'base64').toString('utf8') : undefined);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      this.logger.error('Firebase service account env tidak valid JSON');
      return null;
    }
  }
}
