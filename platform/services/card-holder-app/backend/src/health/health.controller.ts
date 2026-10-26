import { Controller, Get } from '@nestjs/common';

import { Public } from '../common/decorators/session.decorator';
import { CassandraService } from '../shared/cassandra/cassandra.service';

@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly db: CassandraService) {}

  @Get()
  async health(): Promise<{ status: string }> {
    await this.db.client.execute('SELECT release_version FROM system.local');
    return { status: 'ok' };
  }
}
