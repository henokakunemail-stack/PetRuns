import { Module } from '@nestjs/common';
import { WorkerAvailabilityController } from './worker-availability.controller';
import { WorkerAvailabilityService } from './worker-availability.service';

@Module({ controllers: [WorkerAvailabilityController], providers: [WorkerAvailabilityService] })
export class WorkerAvailabilityModule {}
