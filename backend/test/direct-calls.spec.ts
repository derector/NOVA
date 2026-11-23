import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { callIceServers, DirectCalls, parseCallSignal } from '../src/realtime/direct-calls';
import type { CallEnd } from '../src/realtime/direct-calls';

const caller = { userId: 'caller', socketId: 'caller-device' };
const callee = { userId: 'callee', socketId: 'callee-device' };
const extraDevice = { userId: 'callee', socketId: 'other-device' };
const outsider = { userId: 'outsider', socketId: 'outside-device' };
const offer = { description: { type: 'offer' as const, sdp: 'offer' } };
const answer = { description: { type: 'answer' as const, sdp: 'answer' } };

test('only the accepted endpoints can exchange signaling and hang up an active call', () => {
  const endings: CallEnd[] = [];
  const calls = new DirectCalls((_call, reason) => endings.push(reason));
  const active = calls.start('chat', 'video', caller, 'Caller', callee.userId);
  assert.ok(active);
  const id = active.invite.id;
  assert.equal(calls.start('another-chat', 'audio', outsider, 'Other', caller.userId), null);
  assert.equal(calls.accept(id, outsider), null);
  assert.equal(calls.relay(id, caller, offer), null);
  assert.equal(calls.accept(id, callee), active);
  assert.equal(calls.accept(id, extraDevice), null);
  assert.equal(calls.relay(id, extraDevice, answer), null);
  assert.equal(calls.relay(id, callee, offer), null);
  assert.equal(calls.relay(id, callee, answer), null);
  assert.equal(calls.relay(id, caller, offer), callee.socketId);
  assert.equal(calls.relay(id, caller, offer), null);
  assert.equal(calls.relay(id, callee, answer), caller.socketId);
  assert.equal(calls.hangUp(id, extraDevice), false);
  assert.equal(calls.hangUp(id, outsider), false);
  calls.disconnected(extraDevice, () => true);
  assert.equal(calls.hangUp(id, callee), true);
  assert.deepEqual(endings, ['ended']);
  assert.equal(calls.relay(id, caller, offer), null);
});

test('decline and disconnect release participants for their next call', () => {
  const endings: CallEnd[] = [];
  const calls = new DirectCalls((_call, reason) => endings.push(reason));
  const first = calls.start('chat', 'audio', caller, 'Caller', callee.userId);
  assert.ok(first);
  assert.equal(calls.hangUp(first.invite.id, callee), true);
  const second = calls.start('chat', 'audio', caller, 'Caller', callee.userId);
  assert.ok(second);
  calls.disconnected(extraDevice, () => true);
  assert.equal(calls.accept(second.invite.id, callee), second);
  calls.disconnected(callee, () => false);
  assert.deepEqual(endings, ['declined', 'disconnected']);
});

test('an audio-only socket cannot start, accept or decline video calls', () => {
  const calls = new DirectCalls(() => {});
  const audioOnly = { ...extraDevice, audioOnly: true };
  assert.equal(calls.start('chat', 'video', audioOnly, 'Other', caller.userId), null);
  const video = calls.start('chat', 'video', caller, 'Caller', callee.userId);
  assert.ok(video);
  assert.equal(calls.accept(video.invite.id, audioOnly), null);
  assert.equal(calls.hangUp(video.invite.id, audioOnly), false);
  assert.equal(calls.hangUp(video.invite.id, caller), true);
  const audio = calls.start('chat', 'audio', caller, 'Caller', callee.userId);
  assert.ok(audio);
  assert.equal(calls.accept(audio.invite.id, audioOnly), audio);
  assert.equal(calls.hangUp(audio.invite.id, audioOnly), true);
});

test('ICE validation caps payload size and TURN credentials expire without exposing the shared secret', () => {
  const candidate = { candidate: 'candidate:1 1 UDP 100 127.0.0.1 5000 typ host', sdpMLineIndex: 0 };
  assert.deepEqual(parseCallSignal({ candidate }), { candidate: { ...candidate, sdpMid: null, usernameFragment: null } });
  assert.equal(parseCallSignal({ candidate: { ...candidate, sdpMLineIndex: -1 } }), null);
  assert.equal(parseCallSignal({ candidate, description: offer.description }), null);
  assert.equal(parseCallSignal({ description: { type: 'offer', sdp: 'x'.repeat(48_001) } }), null);

  const secret = 'test-turn-secret';
  const now = 1_000_000_000;
  const [stun, turn] = callIceServers({
    CALL_STUN_URLS: 'stun:example.com:3478,https://invalid.example.com',
    CALL_TURN_URLS: 'turns:example.com:5349?transport=tcp',
    CALL_TURN_SECRET: secret,
  }, now);
  assert.deepEqual(stun, { urls: ['stun:example.com:3478'] });
  assert.ok(turn.username && turn.credential);
  assert.equal(Number(turn.username.split(':')[0]), now / 1000 + 12_600);
  assert.equal(turn.credential, createHmac('sha1', secret).update(turn.username).digest('base64'));
  assert.equal(JSON.stringify(turn).includes(secret), false);
});
