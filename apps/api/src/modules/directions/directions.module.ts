import { Module } from '@nestjs/common';
import { AdminDirectionsController, DirectionsController } from './directions.controller';
import { DirectionsService } from './directions.service';

@Module({
  controllers: [DirectionsController, AdminDirectionsController],
  providers: [DirectionsService],
  exports: [DirectionsService],
})
export class DirectionsModule {}
