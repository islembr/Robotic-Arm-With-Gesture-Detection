import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class MovementStepSchema {
  @Prop({ required: true, min: 0, max: 180 })
  base: number;

  @Prop({ required: true, min: 0, max: 180 })
  shoulder: number;

  @Prop({ required: true, min: 0, max: 180 })
  elbow: number;

  @Prop({ required: true, min: 0, max: 180 })
  forearm: number;

  @Prop({ required: true, min: 0, max: 180 })
  wrist: number;

  @Prop({ required: true, min: 0, max: 90 })
  gripper: number;

  @Prop({ required: true, min: 0, default: 500 })
  delayMs: number;
}

@Schema({ collection: 'gesture_mappings', timestamps: true })
export class GestureMappingModel {
  @Prop({ required: true, uppercase: true, trim: true, unique: true, index: true })
  gesture: string;

  @Prop({ required: true, trim: true })
  movementName: string;

  @Prop({ required: true, default: true, index: true })
  enabled: boolean;

  @Prop({ required: true, type: [MovementStepSchema] })
  sequence: MovementStepSchema[];
}

export type GestureMappingDocument = HydratedDocument<GestureMappingModel>;
export const GestureMappingSchema = SchemaFactory.createForClass(GestureMappingModel);
