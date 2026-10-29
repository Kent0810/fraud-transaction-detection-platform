import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  type MessageEvent,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Sse,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { interval, map, merge, type Observable } from 'rxjs';

import { CurrentStaff, Staff, type StaffMember } from '../../common/decorators/staff.decorator';
import { CardId, ZodPipe } from '../../common/validation';
import type { StaffAudit } from '../../shared/prisma/audit';
import { ReleaseMerchantCommand } from '../controls/commands/release-merchant.command';
import { SetMerchantRuleCommand } from '../controls/commands/set-merchant-rule.command';
import { Merchant, type CardStatusDto, type MerchantRuleDto } from '../controls/types/controls.types';
import { OpenCardCommand } from './commands/open-card.command';
import { ReviewAlertCommand } from './commands/review-alert.command';
import { SetCardFrozenCommand } from './commands/set-card-frozen.command';
import { LiveAlertsConsumer } from './consumers/live-alerts.consumer';
import { FindCardQuery } from './queries/find-card.query';
import { GetActivityQuery } from './queries/get-activity.query';
import { GetAuditTrailQuery } from './queries/get-audit-trail.query';
import { GetQueueQuery } from './queries/get-queue.query';
import {
  type ActivityDto,
  AlertId,
  AlertReviewRequest,
  type AuditEntryDto,
  type CardViewDto,
  Days,
  Lookup,
  type QueueItemDto,
  ReasonRequest,
  StaffMerchantRuleRequest,
} from './types/ops.types';

// Keeps idle proxies from closing the live feed.
const HEARTBEAT_MS = 20_000;

const audit = (staff: StaffMember, reason: string | null): StaffAudit => ({ staffId: staff.staffId, reason });

@Controller('ops')
export class OpsController {
  constructor(
    private readonly commands: CommandBus,
    private readonly queries: QueryBus,
    private readonly live: LiveAlertsConsumer,
  ) {}

  @Staff('ANALYST')
  @Get('queue')
  queue(): Promise<QueueItemDto[]> {
    return this.queries.execute(new GetQueueQuery(100));
  }

  @Staff()
  @Sse('alerts/live')
  liveAlerts(): Observable<MessageEvent> {
    return merge(
      this.live.stream.pipe(map((data) => ({ type: 'alert', data }))),
      interval(HEARTBEAT_MS).pipe(map(() => ({ type: 'ping', data: '' }))),
    );
  }

  @Staff()
  @Get('cards')
  async find(@Query('q', new ZodPipe(Lookup)) q: string): Promise<{ cardId: string }> {
    const cardId = await this.queries.execute(new FindCardQuery(q));
    if (!cardId) throw new NotFoundException('no card or account with that number');
    return { cardId };
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
}
