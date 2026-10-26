import { type ArgumentMetadata, BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

export const NEXT_CURSOR = 'X-Next-Cursor';

export const CardId = z.string().regex(/^\d{8,19}$/, 'must be 8 to 19 digits');
export const AccountNumber = z.string().regex(/^\d{6,19}$/, 'must be 6 to 19 digits');
export const BankCode = z.string().regex(/^[A-Z]{2,10}$/, 'must be 2 to 10 capital letters');
export const Cursor = z.string().regex(/^[0-9a-f]{1,2048}$/i, 'must be a hex string').optional();
export const Password = z.string().min(1).max(128);

/** Trimmed, non-empty, at most max characters. */
export const text = (max: number) => z.string().trim().min(1).max(max);

/**
 * Validates a body, param or query value against a zod schema and passes on the parsed value.
 * A failure is a 400 naming each bad field: `@Body(new ZodPipe(LoginRequest)) body: LoginRequest`.
 */
@Injectable()
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown, { type, data }: ArgumentMetadata): z.output<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    // A param or query has its name in data; a body field has it in the issue path.
    const where = (path: PropertyKey[]) => [type === 'body' ? undefined : data, ...path.map(String)].filter(Boolean).join('.');
    throw new BadRequestException(result.error.issues.map((i) => `${where(i.path) || type} ${i.message}`.trim()));
  }
}

export const clamp = (n: number, max: number) => Math.min(Math.max(n, 1), max);
