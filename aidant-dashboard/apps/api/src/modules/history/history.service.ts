import { Injectable } from '@nestjs/common';
import { HistoryRepositoryService } from './history-repository.service';

interface HistoryFilters {
  date?: string;
  gesture?: string;
  result?: string;
}

@Injectable()
export class HistoryService {
  constructor(private readonly historyRepository: HistoryRepositoryService) {}

  async getHistory(filters: HistoryFilters) {
    return this.historyRepository.getHistory(filters);
  }
}
