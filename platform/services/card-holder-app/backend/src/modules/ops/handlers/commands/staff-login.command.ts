import { Command } from '@nestjs/cqrs';

import type { StaffSessionDto } from '../../types/ops.types';

export class StaffLoginCommand extends Command<StaffSessionDto | null> {
  constructor(
    readonly email: string,
    readonly password: string,
  ) {
    super();
  }
}
