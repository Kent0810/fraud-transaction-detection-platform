import { Inject, Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';

import type { Config } from '../config';
import { CONFIG } from '../config.module';

@Injectable()
export class KafkaService implements OnModuleInit, OnApplicationShutdown {
  private readonly log = new Logger(KafkaService.name);
  private readonly producer: KafkaJS.Producer;

  constructor(@Inject(CONFIG) private readonly cfg: Config) {
    const kafka = new KafkaJS.Kafka({ kafkaJS: { brokers: cfg.kafkaBrokers, clientId: 'cardholder-app' } });
    this.producer = kafka.producer({ kafkaJS: { idempotent: true, acks: -1 } });
  }

  async onModuleInit(): Promise<void> {
    this.log.log(`connecting to kafka ${this.cfg.kafkaBrokers.join(',')}`);
    await this.producer.connect();
  }

  async onApplicationShutdown(): Promise<void> {
    await this.producer.disconnect();
  }

  async publish(topic: string, key: string, value: object): Promise<void> {
    await this.producer.send({ topic, messages: [{ key, value: JSON.stringify(value) }] });
  }
}
