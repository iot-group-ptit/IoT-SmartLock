const mqtt = require('mqtt');
require('dotenv').config();

class MQTTClient {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.subscribers = new Map();
  }

  connect() {
    const options = {
      clientId: process.env.MQTT_CLIENT_ID || 'smartlock_backend',
      username: process.env.MQTT_USERNAME,
      password: process.env.MQTT_PASSWORD,
      clean: true,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
    };

    this.client = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883', options);

    this.client.on('connect', () => {
      console.log('MQTT connected successfully');
      this.isConnected = true;
      
      // Subscribe to default topics
      this.subscribe('smartlock/+/auth');
      this.subscribe('smartlock/+/status');
      this.subscribe('smartlock/+/sensor');
    });

    this.client.on('error', (error) => {
      console.error('MQTT connection error:', error.message);
      this.isConnected = false;
    });

    this.client.on('offline', () => {
      console.log('MQTT client offline');
      this.isConnected = false;
    });

    this.client.on('reconnect', () => {
      console.log('MQTT reconnecting...');
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });

    return this.client;
  }

  subscribe(topic, callback) {
    if (!this.client) {
      console.error('MQTT client not initialized');
      return;
    }

    this.client.subscribe(topic, (err) => {
      if (err) {
        console.error(`Failed to subscribe to ${topic}:`, err.message);
      } else {
        console.log(`📥 Subscribed to topic: ${topic}`);
        if (callback) {
          this.subscribers.set(topic, callback);
        }
      }
    });
  }

  publish(topic, message, options = {}) {
    if (!this.client || !this.isConnected) {
      console.error('MQTT client not connected');
      return false;
    }

    const payload = typeof message === 'object' ? JSON.stringify(message) : message;
    
    this.client.publish(topic, payload, { qos: options.qos || 1, retain: options.retain || false }, (err) => {
      if (err) {
        console.error(`Failed to publish to ${topic}:`, err.message);
      } else {
        console.log(`📤 Published to ${topic}:`, payload.substring(0, 100));
      }
    });

    return true;
  }

  handleMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());
      console.log(`📨 Received message on ${topic}:`, payload);

      // Check if there's a specific subscriber for this topic
      for (const [subscribedTopic, callback] of this.subscribers.entries()) {
        if (this.topicMatch(topic, subscribedTopic)) {
          callback(topic, payload);
        }
      }

      // Emit to Socket.IO clients if available
      if (global.io) {
        global.io.emit('mqtt_message', { topic, payload });
      }
    } catch (error) {
      console.error('Error parsing MQTT message:', error.message);
    }
  }

  topicMatch(topic, pattern) {
    const topicParts = topic.split('/');
    const patternParts = pattern.split('/');

    if (patternParts.length > topicParts.length) return false;

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') return true;
      if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) {
        return false;
      }
    }

    return patternParts.length === topicParts.length;
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      console.log('MQTT client disconnected');
    }
  }
}

const mqttClient = new MQTTClient();

module.exports = mqttClient;
