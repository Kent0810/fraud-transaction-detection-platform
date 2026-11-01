import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import { StaffRepository } from '../../repositories/staff.repository';
import type { StaffSessionDto } from '../../types/ops.types';
import { StaffLoginCommand } from '../commands/staff-login.command';

@CommandHandler(StaffLoginCommand)
export class StaffLoginHandler implements ICommandHandler<StaffLoginCommand> {
  constructor(private readonly staff: StaffRepository) {}

  async execute({ email, password }: StaffLoginCommand): Promise<StaffSessionDto | null> {
    const member = await this.staff.login(email, password);
    if (!member) return null;
    const { token, expiresAt } = await this.staff.createSession(member.staffId);
    return { token, expiresAt: expiresAt.toISOString(), ...member };
  }
}
