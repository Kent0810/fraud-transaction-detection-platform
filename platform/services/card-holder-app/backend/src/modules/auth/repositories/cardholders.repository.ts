import { Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';

import { PrismaService } from '../../../shared/prisma/prisma.service';

export type Cardholder = {
  cardId: string;
  name: string;
  email: string;
};

// Same cost as the seed's gen_salt('bf', 8). An unknown card is compared against this throwaway hash,
// so it takes as long as a wrong password and login timing can't be used to probe card numbers.
const NO_SUCH_LOGIN = bcrypt.hashSync('no such login', 8);

@Injectable()
export class CardholdersRepository {
  constructor(private readonly db: PrismaService) {}

  /** The cardholder for a valid, active login, or null. Records the login time on success. */
  async login(cardId: string, password: string): Promise<Cardholder | null> {
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
    if (!login || !passwordOk || login.status !== 'ACTIVE') return null;

    await this.db.client.auth.updateMany({
      where: { card_id: cardId },
      data: { last_login_at: new Date() },
    });
    const c = login.cardholders;
    return { cardId, name: `${c.first_name} ${c.last_name}`, email: c.email };
  }
}
