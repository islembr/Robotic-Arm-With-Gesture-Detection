import { Injectable } from '@nestjs/common';
import { MappingRepositoryService } from '../iot/mapping-repository.service';

interface CreateMappingInput {
  gesture: string;
  movement?: string;
  sequence: Array<{
    base: number;
    shoulder: number;
    elbow: number;
    forearm: number;
    wrist: number;
    gripper: number;
    delay?: number;
    delayMs?: number;
  }>;
}

@Injectable()
export class MappingsService {
  constructor(private readonly mappingRepository: MappingRepositoryService) {}

  async getMappings() {
    // Aidant view is read-only for now; programming remains in the mobile app.
    return this.mappingRepository.getMappings();
  }

  async createMapping(input: CreateMappingInput) {
    return this.mappingRepository.saveMapping(input);
  }
}
