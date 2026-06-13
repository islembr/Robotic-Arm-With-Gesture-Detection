import { Body, Controller, Get, Post } from '@nestjs/common';
import { MappingsService } from './mappings.service';

interface MappingStepBody {
  base: number;
  shoulder: number;
  elbow: number;
  forearm: number;
  wrist: number;
  gripper: number;
  delay?: number;
  delayMs?: number;
}

@Controller('mappings')
export class MappingsController {
  constructor(private readonly mappingsService: MappingsService) {}

  @Get()
  async getMappings() {
    return this.mappingsService.getMappings();
  }

  @Post()
  async createMapping(@Body() body: { gesture?: string; movement?: string; sequence?: MappingStepBody[] } = {}) {
    return this.mappingsService.createMapping({
      gesture: body.gesture ?? '',
      movement: body.movement,
      sequence: Array.isArray(body.sequence) ? body.sequence : [],
    });
  }
}
