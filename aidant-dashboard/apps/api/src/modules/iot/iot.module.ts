import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HistoryModule } from '../history/history.module';
import { GestureExecutionService } from './gesture-execution.service';
import { GestureMappingModel, GestureMappingSchema } from './gesture-mapping.schema';
import { IotStateService } from './iot-state.service';
import { MappingRepositoryService } from './mapping-repository.service';
import { MqttClientService } from './mqtt-client.service';

@Global()
@Module({
  imports: [
    HistoryModule,
    MongooseModule.forFeature([
      { name: GestureMappingModel.name, schema: GestureMappingSchema },
    ]),
  ],
  providers: [IotStateService, MappingRepositoryService, GestureExecutionService, MqttClientService],
  exports: [IotStateService, MappingRepositoryService],
})
export class IotModule {}
