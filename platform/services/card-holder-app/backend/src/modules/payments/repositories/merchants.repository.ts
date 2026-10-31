import { readFileSync } from 'node:fs';

import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { Config } from '../../../config';
import { CONFIG } from '../../../config.module';
import { PrismaService } from '../../../shared/prisma/prisma.service';
import type { MerchantDto } from '../types/payments.types';

export type Merchant = { merchantId: string; name: string; category: string };

/** A merchant placed near the cardholder: where the payment happens, for the fraud detector's location rules. */
export type PlacedMerchant = MerchantDto & { lat: number | null; long: number | null };

const KM_PER_DEGREE = 111.32;
const MIN_KM = 0.3;
const MAX_KM = 12;

/**
 * The Sparkov dataset's merchants (merchants.csv: `category|merchant_name`), one per category for each card. The
 * dataset has no merchant locations, so each is put a few kilometres from the cardholder's home, the same place every
 * time for that card.
 */
@Injectable()
export class MerchantsRepository {
  private readonly merchants: Merchant[];
  private readonly byCategory = new Map<string, Merchant[]>();

  constructor(
    private readonly db: PrismaService,
    @Inject(CONFIG) cfg: Config,
  ) {
    this.merchants = readFileSync(cfg.merchantsFile, 'utf8')
      .split('\n')
      .slice(1)
      .map((line) => line.trim().split('|'))
      .filter((cols) => cols.length === 2 && cols[0] && cols[1])
      .map(([category, name], i) => ({ merchantId: String(i), category, name: name.replace(/^fraud_/, '') }));
    for (const m of this.merchants) {
      this.byCategory.set(m.category, [...(this.byCategory.get(m.category) ?? []), m]);
    }
  }

  /** One merchant per category, nearest first. */
  async nearby(cardId: string): Promise<MerchantDto[]> {
    const home = await this.home(cardId);
    return [...this.byCategory.values()]
      .map((ms) => place(ms[hash(`${cardId}|${ms[0].category}`) % ms.length], cardId, home))
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
      .map(({ lat: _lat, long: _long, ...m }) => m);
  }

  async find(cardId: string, merchantId: string): Promise<PlacedMerchant> {
    return place(this.get(merchantId), cardId, await this.home(cardId));
  }

  get(merchantId: string): Merchant {
    const merchant = this.merchants[Number(merchantId)];
    if (!merchant) throw new NotFoundException('merchant not found');
    return merchant;
  }

  /** By name, for the console's merchant terminal. */
  search(query: string, limit: number): Merchant[] {
    const q = query.trim().toLowerCase();
    return this.merchants.filter((m) => !q || m.name.toLowerCase().includes(q)).slice(0, limit);
  }

  /** Where this merchant is for this card: what nearby() shows for it. */
  async forCard(cardId: string, merchantId: string): Promise<MerchantDto> {
    const { lat: _lat, long: _long, ...m } = await this.find(cardId, merchantId);
    return m;
  }

  private home(cardId: string): Promise<{ lat: number | null; long: number | null } | null> {
    return this.db.client.cardholders.findUnique({ where: { card_id: cardId }, select: { lat: true, long: true } });
  }
}

function place(m: Merchant, cardId: string, home: { lat: number | null; long: number | null } | null): PlacedMerchant {
  if (home?.lat == null || home.long == null) return { ...m, distanceKm: null, lat: null, long: null };
  const h = hash(`${cardId}|${m.merchantId}`);
  const km = MIN_KM + ((h % 1000) / 1000) * (MAX_KM - MIN_KM);
  const bearing = (((h >>> 10) % 360) * Math.PI) / 180;
  const lat = home.lat + (km * Math.cos(bearing)) / KM_PER_DEGREE;
  const long = home.long + (km * Math.sin(bearing)) / (KM_PER_DEGREE * Math.cos((home.lat * Math.PI) / 180));
  return { ...m, distanceKm: Math.round(km * 10) / 10, lat, long };
}

// FNV-1a: small and stable across restarts, so a card always sees the same merchants in the same places.
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
