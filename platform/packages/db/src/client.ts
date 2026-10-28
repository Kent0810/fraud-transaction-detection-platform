import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from './generated/prisma/client';

export type DbConfig = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
};

export function createPrismaClient(cfg: DbConfig): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg(cfg) });
}
