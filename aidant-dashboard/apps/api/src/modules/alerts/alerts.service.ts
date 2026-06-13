import { Injectable, NotFoundException } from '@nestjs/common';
import { alerts } from '../../common/mock-data';
import { AlertItem } from '../../common/types';
import { IotStateService } from '../iot/iot-state.service';

@Injectable()
export class AlertsService {
  private readonly alerts: AlertItem[] = alerts.map((alert) => ({ ...alert }));

  constructor(private readonly iotState: IotStateService) {}

  getAlerts() {
    return this.iotState.getAlerts(this.alerts);
  }

  resolveAlert(id: string) {
    const alert = this.iotState.resolveAlert(id) ?? this.alerts.find((item) => item.id === id);
    if (!alert) {
      throw new NotFoundException('Alerte introuvable');
    }
    alert.status = 'resolved';
    return alert;
  }
}
