import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GestureMapping, MovementStep } from '../../common/types';
import { GestureMappingDocument, GestureMappingModel } from './gesture-mapping.schema';

interface RawMovementStep {
  base: number;
  shoulder: number;
  elbow: number;
  forearm?: number;
  wrist: number;
  gripper: number;
  delay?: number;
  delayMs?: number;
}

export interface SaveGestureMappingInput {
  gesture: string;
  movement?: string;
  sequence: RawMovementStep[];
}

@Injectable()
export class MappingRepositoryService {
  constructor(
    @InjectModel(GestureMappingModel.name)
    private readonly mappingModel: Model<GestureMappingDocument>,
  ) {}

  async getMappings(): Promise<GestureMapping[]> {
    const docs = await this.mappingModel.find().sort({ updatedAt: -1 }).exec();
    return docs.map((doc) => this.toApiMapping(doc));
  }

  async saveMapping(input: SaveGestureMappingInput): Promise<GestureMapping> {
    const gesture = this.normalizeGesture(input.gesture);
    const sequence = this.normalizeSequence(input.sequence);
    const movementName = input.movement?.trim() || `Sequence ${gesture}`;

    const doc = await this.mappingModel
      .findOneAndUpdate(
        { gesture },
        {
          $set: {
            gesture,
            movementName,
            enabled: true,
            sequence,
          },
        },
        {
          new: true,
          upsert: true,
          runValidators: true,
          setDefaultsOnInsert: true,
        },
      )
      .exec();

    return this.toApiMapping(doc);
  }

  async findEnabledByGesture(gesture: string): Promise<GestureMapping | undefined> {
    const normalizedGesture = this.normalizeGesture(gesture);
    const doc = await this.mappingModel.findOne({ gesture: normalizedGesture, enabled: true }).exec();
    return doc ? this.toApiMapping(doc) : undefined;
  }

  private normalizeGesture(value: string) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new BadRequestException('gesture is required');
    }

    return value.trim().toUpperCase();
  }

  private normalizeSequence(steps: RawMovementStep[]): MovementStep[] {
    if (!Array.isArray(steps) || steps.length === 0) {
      throw new BadRequestException('sequence must contain at least one step');
    }

    return steps.map((step, index) => {
      if (!step || typeof step !== 'object') {
        throw new BadRequestException(`sequence[${index}] must be an object`);
      }

      return {
        base: this.clampRequired(step.base, 0, 180, `sequence[${index}].base`),
        shoulder: this.clampRequired(step.shoulder, 0, 180, `sequence[${index}].shoulder`),
        elbow: this.clampRequired(step.elbow, 0, 180, `sequence[${index}].elbow`),
        forearm: this.clampOptional(step.forearm, 90, 0, 180),
        wrist: this.clampRequired(step.wrist, 0, 180, `sequence[${index}].wrist`),
        gripper: this.clampRequired(step.gripper, 0, 90, `sequence[${index}].gripper`),
        delayMs: this.clampOptional(step.delayMs ?? step.delay, 500, 0, 60000),
      };
    });
  }

  private clampRequired(value: unknown, min: number, max: number, field: string) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new BadRequestException(`${field} must be a number`);
    }

    return this.clamp(value, min, max);
  }

  private clampOptional(value: unknown, fallback: number, min: number, max: number) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return fallback;
    }

    return this.clamp(value, min, max);
  }

  private clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, Math.round(value)));
  }

  private toApiMapping(doc: GestureMappingDocument): GestureMapping {
    const createdAt = this.getDate(doc, 'createdAt');
    const movementName = doc.movementName;

    return {
      id: doc.id,
      gestureName: doc.gesture,
      movementName,
      createdDate: createdAt.toISOString().slice(0, 10),
      lastUsed: 'Jamais',
      status: doc.enabled ? 'enabled' : 'disabled',
      notes: 'Sequence programmee depuis l application mobile.',
      sequence: doc.sequence.map((step) => ({
        base: step.base,
        shoulder: step.shoulder,
        elbow: step.elbow,
        forearm: step.forearm,
        wrist: step.wrist,
        gripper: step.gripper,
        delayMs: step.delayMs,
      })),
    };
  }

  private getDate(doc: GestureMappingDocument, key: 'createdAt' | 'updatedAt') {
    const value = doc.get(key) as Date | undefined;
    return value instanceof Date ? value : new Date();
  }
}
