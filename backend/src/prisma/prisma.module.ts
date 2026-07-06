import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// @Global() supaya PrismaService bisa dipakai di semua feature module tanpa
// tiap module harus import PrismaModule secara eksplisit di imports: [].
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
