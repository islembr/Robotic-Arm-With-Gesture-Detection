import { Injectable } from '@nestjs/common';
import { dashboardStats, alerts } from '../../common/mock-data';
import { IotStateService } from '../iot/iot-state.service';
import { MappingRepositoryService } from '../iot/mapping-repository.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly iotState: IotStateService,
    private readonly mappingRepository: MappingRepositoryService,
  ) {}

  async getStats() {
    // Real ESP32/MQTT values override mock values when messages are received.
    const alertsToday = this.iotState.getAlerts(alerts).filter((alert) => alert.status === 'new').length;
    const savedGestures = (await this.mappingRepository.getMappings()).length;
    return this.iotState.getDashboardStats(dashboardStats, savedGestures, alertsToday);
  }
}
