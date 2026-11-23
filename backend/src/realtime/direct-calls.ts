import { createHmac, randomUUID } from 'node:crypto';

export type CallKind = 'audio' | 'video';
export type CallEnd = 'declined' | 'ended' | 'missed' | 'disconnected';
type Description = { type: 'offer' | 'answer'; sdp: string };
type IceCandidate = { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null; usernameFragment: string | null };
type CallSignal = { description: Description } | { candidate: IceCandidate };

export interface CallParty {
  userId: string;
  socketId: string;
  audioOnly?: boolean;
}

export interface CallInvite {
  id: string;
  chatId: string;
  kind: CallKind;
  caller: { id: string; displayName: string };
}

export interface DirectCall {
  invite: CallInvite;
  caller: CallParty;
  calleeId: string;
  callee?: CallParty;
  deadline: NodeJS.Timeout;
  description?: Description['type'];
  candidates: Map<string, number>;
}

export interface IceServer {
  urls: string[];
  username?: string;
  credential?: string;
}

const ringTimeout = 35_000;
const maximumCallDuration = 3 * 60 * 60 * 1000;

export function callIceServers(env = process.env, now = Date.now()): IceServer[] {
  const stun = iceUrls(env.CALL_STUN_URLS, /^stuns?:[^\s,]+$/);
  const turn = iceUrls(env.CALL_TURN_URLS, /^turns?:[^\s,]+$/);
  const secret = env.CALL_TURN_SECRET?.trim();
  const servers: IceServer[] = [];
  if (stun.length) servers.push({ urls: stun });
  if (turn.length && secret) {
    const expiresAt = Math.floor((now + maximumCallDuration + 30 * 60 * 1000) / 1000);
    const username = `${expiresAt}:${randomUUID()}`;
    const credential = createHmac('sha1', secret).update(username).digest('base64');
    servers.push({ urls: turn, username, credential });
  }
  return servers;
}

function iceUrls(value: string | undefined, scheme: RegExp): string[] {
  return (value ?? '').split(',').map((url) => url.trim()).filter((url) => scheme.test(url)).slice(0, 8);
}

export function parseCallSignal(payload: unknown): CallSignal | null {
  if (!payload || typeof payload !== 'object') return null;
  if ('description' in payload && !('candidate' in payload)) {
    const description = payload.description;
    if (!description || typeof description !== 'object' || !('type' in description) || !('sdp' in description)) return null;
    const { type, sdp } = description;
    if ((type !== 'offer' && type !== 'answer') || typeof sdp !== 'string' || sdp.length < 1 || sdp.length > 48_000) return null;
    return { description: { type, sdp } };
  }
  if ('candidate' in payload && !('description' in payload)) {
    const candidate = payload.candidate;
    if (!candidate || typeof candidate !== 'object' || !('candidate' in candidate)) return null;
    if (typeof candidate.candidate !== 'string' || candidate.candidate.length > 2048 || !candidate.candidate.startsWith('candidate:')) return null;
    const sdpMid = 'sdpMid' in candidate ? candidate.sdpMid : null;
    const sdpMLineIndex = 'sdpMLineIndex' in candidate ? candidate.sdpMLineIndex : null;
    const usernameFragment = 'usernameFragment' in candidate ? candidate.usernameFragment : null;
    if (sdpMid !== null && (typeof sdpMid !== 'string' || sdpMid.length > 80)) return null;
    if (sdpMLineIndex !== null && (typeof sdpMLineIndex !== 'number' || !Number.isInteger(sdpMLineIndex) || sdpMLineIndex < 0 || sdpMLineIndex > 32)) return null;
    if (sdpMid === null && sdpMLineIndex === null) return null;
    if (usernameFragment !== null && (typeof usernameFragment !== 'string' || usernameFragment.length > 256)) return null;
    return { candidate: { candidate: candidate.candidate, sdpMid, sdpMLineIndex, usernameFragment } };
  }
  return null;
}

export class DirectCalls {
  private readonly calls = new Map<string, DirectCall>();
  private readonly reservedUsers = new Map<string, string>();

  constructor(private readonly onEnded: (call: DirectCall, reason: CallEnd) => void) {}

  start(chatId: string, kind: CallKind, caller: CallParty, displayName: string, calleeId: string): DirectCall | null {
    if (!this.supports(caller, kind) || caller.userId === calleeId || this.reservedUsers.has(caller.userId) || this.reservedUsers.has(calleeId)) return null;
    const id = randomUUID();
    const call: DirectCall = {
      invite: { id, chatId, kind, caller: { id: caller.userId, displayName } },
      caller,
      calleeId,
      deadline: setTimeout(() => this.finish(id, 'missed'), ringTimeout).unref(),
      candidates: new Map(),
    };
    this.calls.set(id, call);
    this.reservedUsers.set(caller.userId, id);
    this.reservedUsers.set(calleeId, id);
    return call;
  }

  accept(id: string, party: CallParty): DirectCall | null {
    const call = this.calls.get(id);
    if (!call || call.calleeId !== party.userId || call.callee || !this.supports(party, call.invite.kind)) return null;
    call.callee = party;
    clearTimeout(call.deadline);
    call.deadline = setTimeout(() => this.finish(id, 'ended'), maximumCallDuration).unref();
    return call;
  }

  hangUp(id: string, party: CallParty): boolean {
    const call = this.calls.get(id);
    if (!call) return false;
    if (this.sameSocket(call.caller, party) || (call.callee && this.sameSocket(call.callee, party))) {
      this.finish(id, 'ended');
      return true;
    }
    if (!call.callee && call.calleeId === party.userId && this.supports(party, call.invite.kind)) {
      this.finish(id, 'declined');
      return true;
    }
    return false;
  }

  relay(id: string, party: CallParty, signal: CallSignal): string | null {
    const call = this.calls.get(id);
    if (!call?.callee) return null;
    const fromCaller = this.sameSocket(call.caller, party);
    const fromCallee = this.sameSocket(call.callee, party);
    if (!fromCaller && !fromCallee) return null;
    if ('description' in signal) {
      const { type } = signal.description;
      const firstOffer = fromCaller && type === 'offer' && !call.description;
      const firstAnswer = fromCallee && type === 'answer' && call.description === 'offer';
      if (!firstOffer && !firstAnswer) return null;
      call.description = type;
    } else {
      const count = call.candidates.get(party.socketId) ?? 0;
      if (count >= 128) return null;
      call.candidates.set(party.socketId, count + 1);
    }
    return fromCaller ? call.callee.socketId : call.caller.socketId;
  }

  disconnected(party: CallParty, hasReadySocket: (kind: CallKind) => boolean): void {
    const id = this.reservedUsers.get(party.userId);
    if (!id) return;
    const call = this.calls.get(id);
    if (!call) return;
    const recipientUnavailable = !call.callee && call.calleeId === party.userId && !hasReadySocket(call.invite.kind);
    if (this.sameSocket(call.caller, party) || (call.callee && this.sameSocket(call.callee, party)) || recipientUnavailable) {
      this.finish(id, 'disconnected');
    }
  }

  private supports(party: CallParty, kind: CallKind): boolean {
    return kind === 'audio' || !party.audioOnly;
  }

  private sameSocket(first: CallParty, second: CallParty): boolean {
    return first.userId === second.userId && first.socketId === second.socketId;
  }

  private finish(id: string, reason: CallEnd): void {
    const call = this.calls.get(id);
    if (!call) return;
    clearTimeout(call.deadline);
    this.calls.delete(id);
    this.reservedUsers.delete(call.caller.userId);
    this.reservedUsers.delete(call.calleeId);
    this.onEnded(call, reason);
  }
}
