import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashSecret(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value, 'utf8').digest('hex');
}

export function secretMatches(value: string, expectedHex: string, secret: string): boolean {
  const actual = Buffer.from(hashSecret(value, secret), 'hex');
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type IdempotencyDecision = 'create' | 'return-existing' | 'conflict';

export function decideIdempotency(existingText: string | undefined, requestedText: string): IdempotencyDecision {
  if (existingText === undefined) return 'create';
  return existingText === requestedText ? 'return-existing' : 'conflict';
}
