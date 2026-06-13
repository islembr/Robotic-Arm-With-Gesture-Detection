import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { connect, MqttClient } from 'mqtt';
import { GestureExecutionService } from './gesture-execution.service';
import { IotStateService } from './iot-state.service';

@Injectable()
export class MqttClientService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttClientService.name);
  private client?: MqttClient;

  constructor(
    private readonly iotState: IotStateService,
    private readonly gestureExecution: GestureExecutionService,
  ) {}

  onModuleInit() {
    if (process.env.MQTT_ENABLED === 'false') {
      this.logger.log('MQTT disabled with MQTT_ENABLED=false');
      return;
    }

    const brokerUrl = process.env.MQTT_URL ?? 'mqtt://172.20.10.4:1883';
    const topics = this.getTopics();

    this.client = connect(brokerUrl, {
      clientId: process.env.MQTT_CLIENT_ID ?? `aidant-dashboard-api-${Math.random().toString(16).slice(2)}`,
      reconnectPeriod: 3000,
      username: process.env.MQTT_USERNAME || undefined,
      password: process.env.MQTT_PASSWORD || undefined,
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to MQTT broker ${brokerUrl}`);
      this.iotState.setMqttConnected(true);
      this.client?.subscribe(topics, (error) => {
        if (error) {
          this.logger.error(`MQTT subscribe failed: ${error.message}`);
        } else {
          this.logger.log(`Subscribed to MQTT topics: ${topics.join(', ')}`);
        }
      });
    });

    this.client.on('message', async (topic, payload) => {
      const rawPayload = payload.toString('utf8');

      if (topic.includes('gesture')) {
        try {
          const command = await this.gestureExecution.handleGestureMessage(rawPayload);
          if (command) {
            this.publishMovementCommand(command);
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.error(`Gesture execution failed: ${message}`);
        }
        return;
      }

      this.iotState.ingestMqttMessage(topic, rawPayload);
    });

    this.client.on('close', () => {
      this.iotState.setMqttConnected(false);
    });

    this.client.on('error', (error) => {
      this.logger.warn(`MQTT error: ${error.message}`);
    });
  }

  onModuleDestroy() {
    this.client?.end(true);
  }

  private getTopics() {
    const configuredTopics = process.env.MQTT_TOPICS;
    if (configuredTopics) {
      return configuredTopics.split(',').map((topic) => topic.trim()).filter(Boolean);
    }

    // ESP32/Python integration can publish to these topics later.
    return ['arm/status', 'arm/esp32/status', 'arm/gesture', 'arm/activity', 'arm/alerts', 'arm/alert'];
  }

  private publishMovementCommand(command: object) {
    const topic = process.env.MQTT_COMMAND_TOPIC ?? 'arm/command';

    this.client?.publish(topic, JSON.stringify(command), { qos: 0 }, (error) => {
      if (error) {
        this.logger.error(`Failed to publish movement command: ${error.message}`);
      } else {
        this.logger.log(`published arm/command payload: ${JSON.stringify(command)}`);
      }
    });
  }
}
