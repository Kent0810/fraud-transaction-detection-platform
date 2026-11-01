import { Controller, Get, type MessageEvent, Req, Sse, UseGuards } from '@nestjs/common';
import { interval, map, merge, type Observable } from 'rxjs';

import { type CardRequest, CardholderGuard, StaffGuard } from '../auth/guards';
import { EventsService } from '../events/events.service';

const HEARTBEAT_MS = 20_000;

const ping = () => interval(HEARTBEAT_MS).pipe(map((): MessageEvent => ({ type: 'ping', data: '' })));

@Controller()
export class LiveController {
  constructor(private readonly events: EventsService) {}

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @UseGuards(StaffGuard)
  @Sse('ops/alerts/live')
  opsAlerts(): Observable<MessageEvent> {
    return merge(this.events.opsFeed.pipe(map((data): MessageEvent => ({ type: 'alert', data }))), ping());
  }

  @UseGuards(CardholderGuard)
  @Sse('me/notifications/live')
  cardNotices(@Req() req: CardRequest): Observable<MessageEvent> {
    return merge(
      this.events.cardFeed(req.cardId!).pipe(map((data): MessageEvent => ({ type: 'notice', data }))),
      ping(),
    );
  }
}
