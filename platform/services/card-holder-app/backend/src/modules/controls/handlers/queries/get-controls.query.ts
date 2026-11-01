import { Query } from '@nestjs/cqrs';

import type { ControlsDto } from '../../types/controls.types';

export class GetControlsQuery extends Query<ControlsDto> {
  constructor(readonly cardId: string) {
    super();
  }
}
