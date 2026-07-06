import { Module } from '@nestjs/common';
import { WorkerExpertiseController } from './worker-expertise.controller';
import { WorkerExpertiseService } from './worker-expertise.service';

@Module({ controllers: [WorkerExpertiseController], providers: [WorkerExpertiseService] })
export class WorkerExpertiseModule {}
