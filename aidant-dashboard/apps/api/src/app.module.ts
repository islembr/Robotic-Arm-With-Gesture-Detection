import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AlertsModule } from './modules/alerts/alerts.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { HistoryModule } from './modules/history/history.module';
import { IotModule } from './modules/iot/iot.module';
import { MappingsModule } from './modules/mappings/mappings.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { SettingsModule } from './modules/settings/settings.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/aidant'),
    AuthModule,
    IotModule,
    DashboardModule,
    MonitoringModule,
    MappingsModule,
    HistoryModule,
    AlertsModule,
    SettingsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
