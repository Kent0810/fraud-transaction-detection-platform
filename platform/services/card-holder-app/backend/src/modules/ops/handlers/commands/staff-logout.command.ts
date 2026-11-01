import { Command } from '@nestjs/cqrs';

export class StaffLogoutCommand extends Command<void> {
  constructor(readonly token: string | undefined) {
    super();
  }
}
