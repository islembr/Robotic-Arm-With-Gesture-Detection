const mqtt = require('mqtt');

const brokerUrl = process.env.MQTT_URL || 'mqtt://172.20.10.4:1883';
const gestureTopic = process.env.MQTT_GESTURE_TOPIC || 'arm/gesture';
const commandTopic = process.env.MQTT_COMMAND_TOPIC || 'arm/command';
const client = mqtt.connect(brokerUrl, {
  clientId: `aidant-pipeline-test-${Math.random().toString(16).slice(2)}`,
});

const timeout = setTimeout(() => {
  console.log('OK: no default command was published for FIST. User programming is required first.');
  client.end(true, () => process.exit(0));
}, 3000);

client.on('connect', () => {
  client.subscribe(commandTopic, (error) => {
    if (error) {
      console.error(error.message);
      client.end(true, () => process.exit(1));
      return;
    }

    client.publish(
      gestureTopic,
      JSON.stringify({ gesture: 'FIST', confidence: 0.98 }),
    );
  });
});

client.on('message', (topic, payload) => {
  if (topic !== commandTopic) return;

  clearTimeout(timeout);
  console.error(`Unexpected command published on ${commandTopic}: ${payload.toString('utf8')}`);
  client.end(true, () => process.exit(1));
});

client.on('error', (error) => {
  clearTimeout(timeout);
  console.error(error.message);
  client.end(true, () => process.exit(1));
});
