import { hostname } from 'node:os';

import { Inject, Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';

import type { Config } from '../config';
import { CONFIG } from '../config.module';

@Injectable()
export class KafkaService implements OnApplicationShutdown {
  private readonly log = new Logger(KafkaService.name);
  private readonly kafka: KafkaJS.Kafka;
  private readonly consumers: KafkaJS.Consumer[] = [];

  constructor(@Inject(CONFIG) private readonly cfg: Config) {
    this.kafka = new KafkaJS.Kafka({ kafkaJS: { brokers: cfg.kafkaBrokers, clientId: 'notifier' } });
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.consumers.map((c) => c.disconnect()));
  }

  async follow(topic: string, handle: (key: string, value: string) => Promise<void>): Promise<void> {
    const groupId = `notifier-${topic}-${hostname()}-${process.pid}`;
    const consumer = this.kafka.consumer({ kafkaJS: { groupId, fromBeginning: false } });
    this.consumers.push(consumer);
    await consumer.connect();
    await consumer.subscribe({ topics: [topic] });
    this.log.log(`following ${topic} as ${groupId} from ${this.cfg.kafkaBrokers.join(',')}`);
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        await handle(message.key?.toString() ?? '', message.value.toString());
      },
    });
  }
}
