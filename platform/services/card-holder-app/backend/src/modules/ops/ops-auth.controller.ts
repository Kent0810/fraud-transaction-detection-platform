import { Body, Controller, Get, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';

import { Public } from '../../common/decorators/session.decorator';
import { CurrentStaff, Staff, type StaffMember, StaffToken } from '../../common/decorators/staff.decorator';
import { ZodPipe } from '../../common/validation';
import { StaffLoginCommand } from './commands/staff-login.command';
import { StaffLogoutCommand } from './commands/staff-logout.command';
import { StaffLoginRequest, type StaffSessionDto } from './types/ops.types';

@Controller('ops/auth')
export class OpsAuthController {
  constructor(private readonly commands: CommandBus) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodPipe(StaffLoginRequest)) { email, password }: StaffLoginRequest): Promise<StaffSessionDto> {
    const session = await this.commands.execute(new StaffLoginCommand(email, password));
    if (!session) throw new UnauthorizedException('incorrect email or password');
    return session;
  }

  @Staff()
  @Post('logout')
  @HttpCode(204)
  logout(@StaffToken() token: string): Promise<void> {
    return this.commands.execute(new StaffLogoutCommand(token));
  }

  @Staff()
  @Get('me')
  me(@CurrentStaff() staff: StaffMember): StaffMember {
    return staff;
  }
}
