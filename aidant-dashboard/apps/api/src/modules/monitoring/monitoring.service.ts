import { Injectable } from '@nestjs/common';
import { monitoringLive } from '../../common/mock-data';
import { IotStateService } from '../iot/iot-state.service';

@Injectable()
export class MonitoringService {
  constructor(private readonly iotState: IotStateService) {}

  getLive() {
    // The web app still uses HTTP polling; MQTT is handled inside the API.
    return this.iotState.getMonitoringLive(monitoringLive);
  }
}
