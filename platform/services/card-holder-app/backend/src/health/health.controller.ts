import { Controller, Get } from '@nestjs/common';

import { CassandraService } from '../cassandra/cassandra.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: CassandraService) {}

  // Fails (500) if Cassandra can't answer a trivial query.
  @Get()
  async health(): Promise<{ status: string }> {
    await this.db.client.execute('SELECT release_version FROM system.local');
    return { status: 'ok' };
  }
}
