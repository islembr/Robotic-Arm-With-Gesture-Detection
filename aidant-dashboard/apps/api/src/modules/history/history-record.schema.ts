import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { InteractionResult } from '../../common/types';

@Schema({ collection: 'history_items', timestamps: true })
export class HistoryRecordModel {
  @Prop({ required: true })
  dateTime: string;

  @Prop({ required: true, trim: true })
  user: string;

  @Prop({ required: true, trim: true, uppercase: true, index: true })
  detectedGesture: string;

  @Prop({ required: true, trim: true })
  executedMovement: string;

  @Prop({ required: true, enum: ['success', 'failed'], index: true })
  result: InteractionResult;

  @Prop({ required: true, trim: true })
  notes: string;

  @Prop({ trim: true, index: true })
  source?: string;
}

export type HistoryRecordDocument = HydratedDocument<HistoryRecordModel>;
export const HistoryRecordSchema = SchemaFactory.createForClass(HistoryRecordModel);
