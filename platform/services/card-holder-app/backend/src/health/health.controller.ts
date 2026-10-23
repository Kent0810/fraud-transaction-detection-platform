import { Controller, Get } from '@nestjs/common';

import { CassandraService } from '../shared/cassandra/cassandra.service';

@Controller('health')
export class HealthController {
  constructor(private readonly db: CassandraService) {}

  @Get()
  async health(): Promise<{ status: string }> {
    await this.db.client.execute('SELECT release_version FROM system.local');
    return { status: 'ok' };
  }
}
