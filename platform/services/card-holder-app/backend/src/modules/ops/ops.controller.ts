import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { CurrentStaff, Staff, type StaffMember } from '../../common/decorators/staff.decorator';
import { CardId, ZodPipe } from '../../common/validation';
import type { StaffAudit } from '../../shared/prisma/audit';
import { ReleaseMerchantCommand } from '../controls/handlers/commands/release-merchant.command';
import { SetMerchantRuleCommand } from '../controls/handlers/commands/set-merchant-rule.command';
import { Merchant, type CardStatusDto, type MerchantRuleDto } from '../controls/types/controls.types';
import { OpenCardCommand } from './handlers/commands/open-card.command';
import { ReviewAlertCommand } from './handlers/commands/review-alert.command';
import { SetCardFrozenCommand } from './handlers/commands/set-card-frozen.command';
import { SetLoginEnabledCommand } from './handlers/commands/set-login-enabled.command';
import { FindCardQuery } from './handlers/queries/find-card.query';
import { GetActivityQuery } from './handlers/queries/get-activity.query';
import { GetAuditTrailQuery } from './handlers/queries/get-audit-trail.query';
import { GetQueueQuery } from './handlers/queries/get-queue.query';
import { GetRecentCardsQuery } from './handlers/queries/get-recent-cards.query';
import {
  type ActivityDto,
  AlertId,
  AlertReviewRequest,
  type AuditEntryDto,
  type CardViewDto,
  Days,
  Lookup,
  type LoginStatus,
  type QueueItemDto,
  type RecentCardDto,
  ReasonRequest,
  StaffMerchantRuleRequest,
} from './types/ops.types';

const audit = (staff: StaffMember, reason: string | null): StaffAudit => ({ staffId: staff.staffId, reason });

@Controller('ops')
export class OpsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
  ) {}

  @Staff('ANALYST')
  @Get('queue')
  queue(): Promise<QueueItemDto[]> {
    return this.queries.execute(new GetQueueQuery(100));
  }

  @Staff()
  @Get('cards')
  async find(@Query('q', new ZodPipe(Lookup)) q: string): Promise<{ cardId: string }> {
    const cardId = await this.queries.execute(new FindCardQuery(q));
    if (!cardId) throw new NotFoundException('no card or account with that number');
    return { cardId };
  }

  // From the staff member's own audit rows, so it matches what the bank recorded and follows them to any computer.
  @Staff()
  @Get('recent-cards')
  recentCards(@CurrentStaff() staff: StaffMember): Promise<RecentCardDto[]> {
    return this.queries.execute(new GetRecentCardsQuery(staff.staffId));
  }

  @Staff()
  @Get('cards/:cardId')
  async card(
    @CurrentStaff() staff: StaffMember,
    @Param('cardId', new ZodPipe(CardId)) cardId: string,
  ): Promise<CardViewDto> {
    const view = await this.commands.execute(new OpenCardCommand(cardId, audit(staff, null)));
    if (!view) throw new NotFoundException('card not found');
    return view;
  }

  @Staff()
  @Get('cards/:cardId/activity')
  activity(
    @Param('cardId', new ZodPipe(CardId)) cardId: string,
    @Query('days', new ZodPipe(Days)) days: number,
  ): Promise<ActivityDto[]> {
    return this.queries.execute(new GetActivityQuery(cardId, days));
  }

  @Staff()
  @Get('cards/:cardId/audit')
  auditTrail(@Param('cardId', new ZodPipe(CardId)) cardId: string): Promise<AuditEntryDto[]> {
    return this.queries.execute(new GetAuditTrailQuery(cardId));
  }

  @Staff()
  @Put('cards/:cardId/alerts/:alertId')
  @HttpCode(204)
  reviewAlert(
    @CurrentStaff() staff: StaffMember,
    @Param('cardId', new ZodPipe(CardId)) cardId: string,
    @Param('alertId', new ZodPipe(AlertId)) alertId: string,
    @Body(new ZodPipe(AlertReviewRequest)) { ts, status, reason }: AlertReviewRequest,
  ): Promise<void> {
    return this.commands.execute(new ReviewAlertCommand(cardId, alertId, ts, status, audit(staff, reason)));
  }

  @Staff('AGENT')
  @Put('cards/:cardId/merchant-rules/:merchant')
  @HttpCode(202)
  setMerchantRule(
    @CurrentStaff() staff: StaffMember,
    @Param('cardId', new ZodPipe(CardId)) cardId: string,
    @Param('merchant', new ZodPipe(Merchant)) merchant: string,
    @Body(new ZodPipe(StaffMerchantRuleRequest)) { type, reason }: StaffMerchantRuleRequest,
  ): Promise<MerchantRuleDto> {
    return this.commands.execute(new SetMerchantRuleCommand(cardId, merchant, type, audit(staff, reason)));
  }

  @Staff('AGENT')
  @Delete('cards/:cardId/merchant-rules/:merchant')
  @HttpCode(202)
  releaseMerchant(
    @CurrentStaff() staff: StaffMember,
    @Param('cardId', new ZodPipe(CardId)) cardId: string,
    @Param('merchant', new ZodPipe(Merchant)) merchant: string,
    @Body(new ZodPipe(ReasonRequest)) { reason }: ReasonRequest,
  ): Promise<void> {
    return this.commands.execute(new ReleaseMerchantCommand(cardId, merchant, audit(staff, reason)));
  }

  @Staff('AGENT')
  @Post('cards/:cardId/freeze')
  @HttpCode(200)
  freeze(
    @CurrentStaff() staff: StaffMember,
    @Param('cardId', new ZodPipe(CardId)) cardId: string,
    @Body(new ZodPipe(ReasonRequest)) { reason }: ReasonRequest,
  ): Promise<CardStatusDto> {
    return this.commands.execute(new SetCardFrozenCommand(cardId, true, audit(staff, reason)));
  }

  @Staff('AGENT')
  @Post('cards/:cardId/unfreeze')
  @HttpCode(200)
  unfreeze(
    @CurrentStaff() staff: StaffMember,
    @Param('cardId', new ZodPipe(CardId)) cardId: string,
    @Body(new ZodPipe(ReasonRequest)) { reason }: ReasonRequest,
  ): Promise<CardStatusDto> {
    return this.commands.execute(new SetCardFrozenCommand(cardId, false, audit(staff, reason)));
  }

  @Staff('AGENT')
  @Post('cards/:cardId/login/disable')
  @HttpCode(200)
  disableLogin(
    @CurrentStaff() staff: StaffMember,
    @Param('cardId', new ZodPipe(CardId)) cardId: string,
    @Body(new ZodPipe(ReasonRequest)) { reason }: ReasonRequest,
  ): Promise<{ status: LoginStatus }> {
    return this.setLogin(cardId, false, audit(staff, reason));
  }

  @Staff('AGENT')
  @Post('cards/:cardId/login/restore')
  @HttpCode(200)
  restoreLogin(
    @CurrentStaff() staff: StaffMember,
    @Param('cardId', new ZodPipe(CardId)) cardId: string,
    @Body(new ZodPipe(ReasonRequest)) { reason }: ReasonRequest,
  ): Promise<{ status: LoginStatus }> {
    return this.setLogin(cardId, true, audit(staff, reason));
  }

  private async setLogin(cardId: string, enabled: boolean, by: StaffAudit): Promise<{ status: LoginStatus }> {
    const status = await this.commands.execute(new SetLoginEnabledCommand(cardId, enabled, by));
    if (!status) throw new NotFoundException('this card has no app sign-in');
    return { status };
  }
}
