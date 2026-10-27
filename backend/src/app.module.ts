import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { SpeciesModule } from './modules/species/species.module';
import { BreedsModule } from './modules/breeds/breeds.module';
import { PetsModule } from './modules/pets/pets.module';
import { WorkerProfileModule } from './modules/worker-profile/worker-profile.module';
import { WorkerExpertiseModule } from './modules/worker-expertise/worker-expertise.module';
import { WorkerPricingModule } from './modules/worker-pricing/worker-pricing.module';
import { WorkerAvailabilityModule } from './modules/worker-availability/worker-availability.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PayoutsModule } from './modules/payouts/payouts.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { HealthController } from './health/health.controller';
import { JwtAuthGuard } from './modules/auth/guards/public-guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Cache in-memory untuk data master (species/breeds). Kalau nanti backend
    // jalan multi-instance, ganti store ke Redis — interface-nya sama.
    CacheModule.register({ isGlobal: true }),
    // Rate limit global: 100 request / menit per IP. Cukup longgar untuk pemakaian
    // normal mobile app, tapi menahan brute-force login & scraping.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        global: true,
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ??
            '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
      global: true,
    }),
    WorkerProfileModule,
    WorkerExpertiseModule,
    WorkerPricingModule,
    WorkerAvailabilityModule,
    BookingsModule,
    PaymentsModule,
    PayoutsModule,
    ReviewsModule,
    NotificationsModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    SpeciesModule,
    BreedsModule,
    PetsModule,
  ],
  controllers: [HealthController],
  providers: [
    // Urutan penting: Throttler paling depan (tolak flood sebelum kerja lain),
    // lalu JwtAuthGuard (isi request.user), baru RolesGuard (baca request.user).
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
