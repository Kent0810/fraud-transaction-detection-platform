import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { StaffRepository } from '../../repositories/staff.repository';
import { StaffLogoutCommand } from '../commands/staff-logout.command';

@CommandHandler(StaffLogoutCommand)
export class StaffLogoutHandler implements ICommandHandler<StaffLogoutCommand> {
  constructor(private readonly staff: StaffRepository) {}

  async execute({ token }: StaffLogoutCommand): Promise<void> {
    if (token) await this.staff.revoke(token);
  }
}
