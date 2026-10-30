import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

import { PrismaService } from '../../../shared/prisma/prisma.service';

export type Cardholder = {
  cardId: string;
  name: string;
  email: string;
};

/** OK with the cardholder, or why not. LOCKED and DISABLED are only told to someone who got the password right. */
export type LoginResult =
  { outcome: 'OK'; holder: Cardholder } | { outcome: 'INVALID' } | { outcome: 'LOCKED' } | { outcome: 'DISABLED' };

// Wrong passwords in a row before the login locks; an agent restores it from the console.
const MAX_FAILED_LOGINS = 5;

// Same cost as the seed's gen_salt('bf', 8). An unknown card is compared against this throwaway hash,
// so it takes as long as a wrong password and login timing can't be used to probe card numbers.
const NO_SUCH_LOGIN = bcrypt.hashSync('no such login', 8);

@Injectable()
export class CardholdersRepository {
  constructor(private readonly db: PrismaService) {}

  /**
   * Checks the password. A good one on an active login resets the wrong-password count and records the login time;
   * a wrong one counts, and the last allowed one locks the login.
   */
  async login(cardId: string, password: string): Promise<LoginResult> {
    const login = await this.db.client.auth.findUnique({
      where: { card_id: cardId },
      select: {
        password_hash: true,
        status: true,
        cardholders: {
          select: {
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });
    const passwordOk = await bcrypt.compare(password, login?.password_hash ?? NO_SUCH_LOGIN);
    if (!login) return { outcome: 'INVALID' };

    if (!passwordOk) {
      if (login.status === 'ACTIVE') await this.countFailure(cardId);
      return { outcome: 'INVALID' };
    }
    if (login.status === 'LOCKED') return { outcome: 'LOCKED' };
    if (login.status !== 'ACTIVE') return { outcome: 'DISABLED' };

    await this.db.client.auth.updateMany({
      where: { card_id: cardId },
      data: {
        last_login_at: new Date(),
        failed_logins: 0,
      },
    });
    const c = login.cardholders;
    return {
      outcome: 'OK',
      holder: { cardId, name: `${c.first_name} ${c.last_name}`, email: c.email },
    };
  }

  private async countFailure(cardId: string): Promise<void> {
    await this.db.client.$transaction([
      this.db.client.auth.updateMany({
        where: {
          card_id: cardId,
          status: 'ACTIVE',
        },
        data: { failed_logins: { increment: 1 } },
      }),
      this.db.client.auth.updateMany({
        where: {
          card_id: cardId,
          status: 'ACTIVE',
          failed_logins: { gte: MAX_FAILED_LOGINS },
        },
        data: { status: 'LOCKED' },
      }),
    ]);
  }
}
