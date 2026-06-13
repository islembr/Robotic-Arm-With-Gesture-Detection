import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HistoryController } from './history.controller';
import { HistoryRecordModel, HistoryRecordSchema } from './history-record.schema';
import { HistoryRepositoryService } from './history-repository.service';
import { HistoryService } from './history.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HistoryRecordModel.name, schema: HistoryRecordSchema },
    ]),
  ],
  controllers: [HistoryController],
  providers: [HistoryService, HistoryRepositoryService],
  exports: [HistoryRepositoryService],
})
export class HistoryModule {}
