import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const CARD_ID = /^\d{8,19}$/;
const CURSOR = /^[0-9a-f]{1,2048}$/i;

export const NEXT_CURSOR = 'X-Next-Cursor';

@Injectable()
export class CardIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!CARD_ID.test(value)) throw new BadRequestException('cardId must be 8 to 19 digits');
    return value;
  }
}

@Injectable()
export class CursorPipe implements PipeTransform<string | undefined, string | undefined> {
  transform(value: string | undefined): string | undefined {
    if (value !== undefined && !CURSOR.test(value)) throw new BadRequestException('invalid cursor');
    return value;
  }
}

export const clamp = (n: number, max: number) => Math.min(Math.max(n, 1), max);

export function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new BadRequestException(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}

export function text(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new BadRequestException(`${name} must be a non-empty string of at most ${max} characters`);
  }
  return value.trim();
}

export function positive(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new BadRequestException(`${name} must be a positive number`);
  }
  return value;
}

export function oneOf<T extends string>(value: unknown, name: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new BadRequestException(`${name} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}
