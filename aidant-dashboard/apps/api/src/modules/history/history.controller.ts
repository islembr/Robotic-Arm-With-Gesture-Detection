import { Controller, Get, Query } from '@nestjs/common';
import { HistoryService } from './history.service';

@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  getHistory(
    @Query('date') date?: string,
    @Query('gesture') gesture?: string,
    @Query('result') result?: string,
  ) {
    return this.historyService.getHistory({ date, gesture, result });
  }
}
