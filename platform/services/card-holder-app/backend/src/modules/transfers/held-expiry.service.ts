import { Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { expireHeld } from '@platform/db';

import { PrismaService } from '../../shared/prisma/prisma.service';

const EVERY_MS = 60_000;

/** Declines held transfers nobody confirmed in time (NOT_CONFIRMED). Safe on several instances: each row goes once. */
@Injectable()
export class HeldExpiryService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger(HeldExpiryService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(private readonly db: PrismaService) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.run(), EVERY_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  private async run(): Promise<void> {
    try {
      await expireHeld(this.db.client);
    } catch (e) {
      this.log.warn(`could not expire held transfers: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}
