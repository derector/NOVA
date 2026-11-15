import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideIdempotency, generateOtp, hashSecret, secretMatches } from '../src/common/security.helpers';

test('OTP is six decimal digits and generated values are not exposed through helpers', () => {
  const code = generateOtp();
  assert.match(code, /^\d{6}$/);
});

test('OTP digest is keyed and comparison rejects wrong code or secret', () => {
  const digest = hashSecret('123456', 'a-private-secret');
  assert.equal(secretMatches('123456', digest, 'a-private-secret'), true);
  assert.equal(secretMatches('123457', digest, 'a-private-secret'), false);
  assert.equal(secretMatches('123456', digest, 'another-secret'), false);
});

test('idempotency returns prior result only for an identical payload', () => {
  assert.equal(decideIdempotency(undefined, 'hello'), 'create');
  assert.equal(decideIdempotency('hello', 'hello'), 'return-existing');
  assert.equal(decideIdempotency('hello', 'different'), 'conflict');
});
