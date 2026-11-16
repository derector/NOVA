import test from 'node:test';
import assert from 'node:assert/strict';
import { RealtimePresenceService } from '../src/realtime/realtime-presence.service';

test('presence heartbeat is online until its TTL expires', () => {
  const service = new RealtimePresenceService();
  const start = 10_000;
  assert.equal(service.heartbeat('user-1', start).status, 'online');
  assert.equal(service.get('user-1', start + 9_999).status, 'online');
  assert.equal(service.get('user-1', start + 60_001).status, 'offline');
  service.onModuleDestroy();
});

test('typing state is edge-triggered and expires quickly', () => {
  const service = new RealtimePresenceService();
  const start = 20_000;
  assert.equal(service.setTyping('chat-1', 'user-1', start), true);
  assert.equal(service.setTyping('chat-1', 'user-1', start + 100), false);
  assert.equal(service.isTyping('chat-1', 'user-1', start + 7_999), true);
  assert.equal(service.isTyping('chat-1', 'user-1', start + 8_001), false);
  assert.equal(service.stopTyping('chat-1', 'user-1'), false);
  service.onModuleDestroy();
});
