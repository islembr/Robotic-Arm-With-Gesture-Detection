import { Controller, Get, Param, Patch } from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  getAlerts() {
    return this.alertsService.getAlerts();
  }

  @Patch(':id/resolve')
  resolveAlert(@Param('id') id: string) {
    return this.alertsService.resolveAlert(id);
  }
}
