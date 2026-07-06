import { Module } from '@nestjs/common';
import { WorkerPricingController } from './worker-pricing.controller';
import { WorkerPricingService } from './worker-pricing.service';

@Module({ controllers: [WorkerPricingController], providers: [WorkerPricingService] })
export class WorkerPricingModule {}
