import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Put, Query } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';

import { CurrentStaff, Staff, type StaffMember } from '../../common/decorators/staff.decorator';
import { CardId, ZodPipe } from '../../common/validation';
import type { StaffAudit } from '../../shared/prisma/audit';
import { ReleaseRecipientCommand } from '../controls/handlers/commands/release-recipient.command';
import { SetRecipientRuleCommand } from '../controls/handlers/commands/set-recipient-rule.command';
import type { CardStatusDto, RecipientRuleDto } from '../controls/types/controls.types';
import { accountRecipient, merchantRecipient } from '../controls/types/recipient';
import { OpenCardCommand } from './handlers/commands/open-card.command';
import { RemoveFraudMarkCommand } from './handlers/commands/remove-fraud-mark.command';
import { ResolveFollowupCommand } from './handlers/commands/resolve-followup.command';
import { ReviewAlertCommand } from './handlers/commands/review-alert.command';
import { SetCardFrozenCommand } from './handlers/commands/set-card-frozen.command';
import { SetLoginEnabledCommand } from './handlers/commands/set-login-enabled.command';
import { FindCardQuery } from './handlers/queries/find-card.query';
import { GetActivityQuery } from './handlers/queries/get-activity.query';
import { GetAuditTrailQuery } from './handlers/queries/get-audit-trail.query';
import { GetFlaggedPaymentsQuery } from './handlers/queries/get-flagged-payments.query';
import { GetFollowupsQuery } from './handlers/queries/get-followups.query';
import { GetFraudMarksQuery } from './handlers/queries/get-fraud-marks.query';
import { GetQueueQuery } from './handlers/queries/get-queue.query';
import { GetRecentCardsQuery } from './handlers/queries/get-recent-cards.query';
import {
  type ActivityDto,
  AlertId,
  AlertReviewRequest,
  type AuditEntryDto,
  type CardViewDto,
  Days,
  type FlaggedPaymentDto,
  type FollowupDto,
  FollowupOutcomeRequest,
  type FraudMarkDto,
  Lookup,
  type LoginStatus,
  type QueueItemDto,
  type RecentCardDto,
  ReasonRequest,
  RecipientId,
  StaffRecipientRuleRequest,
  TxnId,
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

  @Staff('ANALYST')
  @Get('flagged-payments')
  flaggedPayments(): Promise<FlaggedPaymentDto[]> {
    return this.queries.execute(new GetFlaggedPaymentsQuery(24));
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

  // Analysts judge alerts; confirming one sends the transaction to the agents to call the cardholder.
  @Staff('ANALYST')
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
  @Put('cards/:cardId/recipient-rules')
  @HttpCode(202)
  setRecipientRule(
    @CurrentStaff() staff: StaffMember,
    @Param('cardId', new ZodPipe(CardId)) cardId: string,
    @Body(new ZodPipe(StaffRecipientRuleRequest)) { recipient, type, reason }: StaffRecipientRuleRequest,
  ): Promise<RecipientRuleDto> {
    const target =
      recipient.kind === 'MERCHANT'
        ? merchantRecipient(recipient.name)
        : accountRecipient(recipient.account, recipient.name);
    return this.commands.execute(new SetRecipientRuleCommand(cardId, target, type, audit(staff, reason)));
  }

  @Staff('AGENT')
  @Delete('cards/:cardId/recipient-rules/:recipientId')
  @HttpCode(202)
  releaseRecipient(
    @CurrentStaff() staff: StaffMember,
    @Param('cardId', new ZodPipe(CardId)) cardId: string,
    @Param('recipientId', new ZodPipe(RecipientId)) recipientId: string,
    @Body(new ZodPipe(ReasonRequest)) { reason }: ReasonRequest,
  ): Promise<void> {
    return this.commands.execute(new ReleaseRecipientCommand(cardId, recipientId, audit(staff, reason)));
  }

  // Agents work the pending ones; analysts see how their confirmed alerts turned out.
  @Staff()
  @Get('follow-ups')
  followups(): Promise<FollowupDto[]> {
    return this.queries.execute(new GetFollowupsQuery(200));
  }

  @Staff('AGENT')
  @Post('follow-ups/:cardId/:txnId')
  @HttpCode(204)
  resolveFollowup(
    @CurrentStaff() staff: StaffMember,
    @Param('cardId', new ZodPipe(CardId)) cardId: string,
    @Param('txnId', new ZodPipe(TxnId)) txnId: string,
    @Body(new ZodPipe(FollowupOutcomeRequest)) { outcome, reason }: FollowupOutcomeRequest,
  ): Promise<void> {
    return this.commands.execute(new ResolveFollowupCommand(cardId, txnId, outcome, audit(staff, reason)));
  }

  @Staff()
  @Get('fraud-marks')
  fraudMarks(): Promise<FraudMarkDto[]> {
    return this.queries.execute(new GetFraudMarksQuery(200));
  }

  // Only analysts: an agent who thinks a mark is wrong asks one.
  @Staff('ANALYST')
  @Delete('fraud-marks/:recipientId')
  @HttpCode(204)
  removeFraudMark(
    @CurrentStaff() staff: StaffMember,
    @Param('recipientId', new ZodPipe(RecipientId)) recipientId: string,
    @Body(new ZodPipe(ReasonRequest)) { reason }: ReasonRequest,
  ): Promise<void> {
    return this.commands.execute(new RemoveFraudMarkCommand(recipientId, audit(staff, reason)));
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
