import { Command, CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { StaffRepository } from '../repositories/staff.repository';

export class StaffLogoutCommand extends Command<void> {
  constructor(readonly token: string | undefined) {
    super();
  }
}

@CommandHandler(StaffLogoutCommand)
export class StaffLogoutHandler implements ICommandHandler<StaffLogoutCommand> {
  constructor(private readonly staff: StaffRepository) {}

  async execute({ token }: StaffLogoutCommand): Promise<void> {
    if (token) await this.staff.revoke(token);
  }
}
