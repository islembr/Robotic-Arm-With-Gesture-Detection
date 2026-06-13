import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HistoryItem, InteractionResult } from '../../common/types';
import { HistoryRecordDocument, HistoryRecordModel } from './history-record.schema';

interface HistoryFilters {
  date?: string;
  gesture?: string;
  result?: string;
}

interface CreateHistoryInput {
  user: string;
  detectedGesture: string;
  executedMovement: string;
  result: InteractionResult;
  notes: string;
  date?: Date;
  source?: string;
}

@Injectable()
export class HistoryRepositoryService implements OnModuleInit {
  constructor(
    @InjectModel(HistoryRecordModel.name)
    private readonly historyModel: Model<HistoryRecordDocument>,
  ) {}

  async onModuleInit() {
    await this.seedDemoHistory();
  }

  async getHistory(filters: HistoryFilters): Promise<HistoryItem[]> {
    const query: Record<string, unknown> = {};

    if (filters.date) {
      query.dateTime = { $regex: `^${this.escapeRegex(filters.date)}` };
    }
    if (filters.gesture) {
      query.detectedGesture = filters.gesture.toUpperCase();
    }
    if (filters.result) {
      query.result = filters.result;
    }

    const docs = await this.historyModel.find(query).sort({ dateTime: -1 }).limit(100).exec();
    return docs.map((doc) => this.toApiHistory(doc));
  }

  async recordExecution(input: CreateHistoryInput): Promise<HistoryItem> {
    const doc = await this.historyModel.create({
      dateTime: this.formatDateTime(input.date ?? new Date()),
      user: input.user,
      detectedGesture: input.detectedGesture.toUpperCase(),
      executedMovement: input.executedMovement,
      result: input.result,
      notes: input.notes,
      source: input.source ?? 'real',
    });

    return this.toApiHistory(doc);
  }

  private async seedDemoHistory() {
    const existingSeedCount = await this.historyModel.countDocuments({ source: 'demo-seed' }).exec();
    if (existingSeedCount > 0) return;

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(now.getDate() - 2);

    await this.historyModel.insertMany([
      {
        dateTime: this.formatDateTime(this.withTime(twoDaysAgo, 9, 20)),
        user: 'Demo Patient',
        detectedGesture: 'FIST',
        executedMovement: 'Fist',
        result: 'success',
        notes: 'Donnee demo: sequence executee correctement.',
        source: 'demo-seed',
      },
      {
        dateTime: this.formatDateTime(this.withTime(twoDaysAgo, 14, 45)),
        user: 'Demo Patient',
        detectedGesture: 'THUMBS_UP',
        executedMovement: 'Thumbs Up',
        result: 'success',
        notes: 'Donnee demo: mouvement termine.',
        source: 'demo-seed',
      },
      {
        dateTime: this.formatDateTime(this.withTime(twoDaysAgo, 17, 10)),
        user: 'Demo Patient',
        detectedGesture: 'VICTORY',
        executedMovement: 'Not available',
        result: 'failed',
        notes: 'Donnee demo: aucun mouvement associe.',
        source: 'demo-seed',
      },
      {
        dateTime: this.formatDateTime(this.withTime(yesterday, 10, 5)),
        user: 'Demo Patient',
        detectedGesture: 'OPEN_HAND',
        executedMovement: 'Open Hand',
        result: 'success',
        notes: 'Donnee demo: mapping trouve et envoye au bras.',
        source: 'demo-seed',
      },
      {
        dateTime: this.formatDateTime(this.withTime(yesterday, 13, 30)),
        user: 'Demo Patient',
        detectedGesture: 'INDEX_ONLY',
        executedMovement: 'Not available',
        result: 'failed',
        notes: 'Donnee demo: geste detecte sans sequence active.',
        source: 'demo-seed',
      },
      {
        dateTime: this.formatDateTime(this.withTime(yesterday, 16, 15)),
        user: 'Demo Patient',
        detectedGesture: 'FIST',
        executedMovement: 'Fist',
        result: 'success',
        notes: 'Donnee demo: execution terminee.',
        source: 'demo-seed',
      },
    ]);
  }

  private withTime(date: Date, hour: number, minute: number) {
    const next = new Date(date);
    next.setHours(hour, minute, 0, 0);
    return next;
  }

  private formatDateTime(date: Date) {
    return date.toISOString().slice(0, 16).replace('T', ' ');
  }

  private toApiHistory(doc: HistoryRecordDocument): HistoryItem {
    return {
      id: doc.id,
      dateTime: doc.dateTime,
      user: doc.user,
      detectedGesture: doc.detectedGesture,
      executedMovement: doc.executedMovement,
      result: doc.result,
      notes: doc.notes,
    };
  }

  private escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
