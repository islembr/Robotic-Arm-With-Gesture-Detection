import { Injectable } from '@nestjs/common';
import { profileSettings } from '../../common/mock-data';

@Injectable()
export class SettingsService {
  getProfile() {
    return {
      ...profileSettings,
      connection: {
        ...profileSettings.connection,
        broker: process.env.MQTT_URL ?? profileSettings.connection.broker,
        deviceId: process.env.MQTT_DEVICE_ID ?? profileSettings.connection.deviceId,
        lastSync: profileSettings.connection.lastSync,
      },
    };
  }
}
