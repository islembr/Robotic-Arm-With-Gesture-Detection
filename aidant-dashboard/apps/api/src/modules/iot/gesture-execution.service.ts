import { Injectable, Logger } from '@nestjs/common';
import { MovementStep } from '../../common/types';
import { HistoryRepositoryService } from '../history/history-repository.service';
import { IotStateService } from './iot-state.service';
import { MappingRepositoryService } from './mapping-repository.service';

export interface MovementCommand {
  cmd: 'sequence';
  source: 'aidant-api';
  gesture: string;
  mappingId: string;
  movementName: string;
  sequence: MovementStep[];
  createdAt: string;
}

@Injectable()
export class GestureExecutionService {
  private readonly logger = new Logger(GestureExecutionService.name);

  constructor(
    private readonly mappings: MappingRepositoryService,
    private readonly iotState: IotStateService,
    private readonly historyRepository: HistoryRepositoryService,
  ) {}

  async handleGestureMessage(rawPayload: string): Promise<MovementCommand | undefined> {
    const payload = this.parsePayload(rawPayload);
    const gesture = this.extractGesture(payload, rawPayload);
    const confidence = this.extractConfidence(payload);
    this.logger.log(`received gesture: ${gesture ?? 'UNKNOWN'} confidence=${confidence}`);

    if (!gesture || gesture === 'NONE') {
      this.logger.warn('mapping not found: gesture payload is empty or NONE');
      this.iotState.recordGestureExecution({
        gesture: gesture || 'UNKNOWN',
        movement: 'Aucun',
        confidence,
        result: 'failed',
        notes: 'Message arm/gesture recu sans geste exploitable.',
      });
      await this.recordHistory(gesture || 'UNKNOWN', 'Not available', 'failed', 'Message arm/gesture recu sans geste exploitable.');
      return undefined;
    }

    const mapping = await this.mappings.findEnabledByGesture(gesture);
    if (!mapping) {
      const message = 'Aucun mouvement associé à ce geste';
      this.logger.warn(`mapping not found for gesture: ${gesture}`);
      this.iotState.recordGestureExecution({
        gesture,
        movement: 'Aucun',
        confidence,
        result: 'failed',
        notes: message,
      });
      this.iotState.createAlert(message, `Geste recu sans mapping actif: ${gesture}`, 'medium');
      await this.recordHistory(gesture, 'Not available', 'failed', message);
      return undefined;
    }

    this.logger.log(`mapping found: ${gesture} -> ${mapping.movementName} (${mapping.sequence.length} steps)`);
    const command: MovementCommand = {
      cmd: 'sequence',
      source: 'aidant-api',
      gesture,
      mappingId: mapping.id,
      movementName: mapping.movementName,
      sequence: mapping.sequence,
      createdAt: new Date().toISOString(),
    };

    this.iotState.recordGestureExecution({
      gesture,
      movement: mapping.movementName,
      confidence,
      result: 'success',
      notes: `Sequence publiee sur arm/command (${mapping.sequence.length} etape(s)).`,
    });
    await this.recordHistory(
      gesture,
      mapping.movementName,
      'success',
      `Sequence publiee sur arm/command (${mapping.sequence.length} etape(s)).`,
    );

    return command;
  }

  private async recordHistory(
    gesture: string,
    movement: string,
    result: 'success' | 'failed',
    notes: string,
  ) {
    await this.historyRepository.recordExecution({
      user: 'Demo Patient',
      detectedGesture: gesture,
      executedMovement: movement,
      result,
      notes,
      source: 'real',
    });
  }

  private parsePayload(rawPayload: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(rawPayload) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
    } catch {
      return { gesture: rawPayload };
    }
  }

  private extractGesture(payload: Record<string, unknown>, rawPayload: string) {
    const value = payload.gesture ?? payload.name ?? payload.detectedGesture;
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim().toUpperCase();
    }

    return rawPayload.trim().length > 0 ? rawPayload.trim().toUpperCase() : undefined;
  }

  private extractConfidence(payload: Record<string, unknown>) {
    const value = payload.confidence;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 0;
    }

    return value > 1 ? value / 100 : value;
  }
}
