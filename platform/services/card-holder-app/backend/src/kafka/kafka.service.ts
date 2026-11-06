import { Inject, Injectable, OnApplicationShutdown } from '@nestjs/common';
import { KafkaJS } from '@confluentinc/kafka-javascript';

import type { Config } from '../config';
import { CONFIG } from '../config.module';

@Injectable()
export class KafkaService implements OnApplicationShutdown {
  private readonly kafka: KafkaJS.Kafka;
  private readonly consumers: KafkaJS.Consumer[] = [];

  constructor(@Inject(CONFIG) cfg: Config) {
    this.kafka = new KafkaJS.Kafka({ kafkaJS: { brokers: cfg.kafkaBrokers, clientId: 'cardholder-app' } });
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.all(this.consumers.map((c) => c.disconnect()));
  }

  // A message is redelivered if handle() throws, so handle() must be safe to repeat.
  // fromBeginning applies only to a group with no committed offsets yet.
  async consume(
    groupId: string,
    topic: string,
    handle: (key: string, value: string) => Promise<void>,
    fromBeginning = true,
  ): Promise<void> {
    const consumer = this.kafka.consumer({ kafkaJS: { groupId, fromBeginning } });
    this.consumers.push(consumer);
    await consumer.connect();
    await consumer.subscribe({ topics: [topic] });
    await consumer.run({
      eachMessage: async ({ message }) => {
        if (!message.value) return;
        await handle(message.key?.toString() ?? '', message.value.toString());
      },
    });
  }
}
