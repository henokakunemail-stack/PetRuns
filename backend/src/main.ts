import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger / OpenAPI documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('PetWalk API')
    .setDescription(
      'Backend API untuk aplikasi PetWalk — pencarian dan pemesanan jasa pet care (anjing, kucing, kelinci, dll)',
    )
    .setVersion('0.1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addTag('Auth', 'Registrasi, login, dan refresh token')
    .addTag('Users', 'Manajemen profil user')
    .addTag('Species', 'Master data spesies hewan')
    .addTag('Breeds', 'Master data ras hewan')
    .addTag('Pets', 'CRUD hewan peliharaan user')
    .addTag('Worker Profiles', 'Registrasi, profil kerja, dan verifikasi admin')
    .addTag('Bookings', 'Pencarian worker, booking, dan status sesi')
    .addTag('Payments', 'Pembayaran booking via Midtrans Snap & webhook notifikasi')
    .addTag('Payouts', 'Pencairan dana ke worker (dicatat manual oleh admin)')
    .addTag('Reviews', 'Rating & ulasan worker setelah booking selesai')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`PetWalk backend running on http://localhost:${port}/api`);
  console.log(`Swagger docs:        http://localhost:${port}/api/docs`);
}
bootstrap();
