'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { NovaChat } from '@/lib/types';
import styles from './call-controls.module.css';

type CallKind = 'audio' | 'video';
type CallPhase = 'incoming' | 'permission' | 'ringing' | 'connecting' | 'connected';
type CallView = { phase: CallPhase; kind: CallKind; name: string };
type ErrorAck = { ok: false; error?: { message?: string } };
type StartAck = { ok: true; callId: string; iceServers: RTCIceServer[] } | ErrorAck;
type ReadyAck = { ok: true } | ErrorAck;
type Invite = { id: string; kind: CallKind; caller: { displayName: string } };
type Signal = { callId: string } & ({ description: RTCSessionDescriptionInit } | { candidate: RTCIceCandidateInit });
type End = { callId: string; reason: 'declined' | 'ended' | 'missed' | 'disconnected' };
type CallRuntime = {
  id?: string;
  view: CallView;
  socket: Socket;
  outgoing: boolean;
  iceServers?: RTCIceServer[];
  local?: MediaStream;
  remote?: MediaStream;
  peer?: RTCPeerConnection;
  pendingSignals: Signal[];
  pendingCandidates: RTCIceCandidateInit[];
  earlyAcceptedId?: string;
  earlyEnd?: End;
  negotiation?: Promise<void>;
  deadline?: number;
};

const phaseText: Record<CallPhase, string> = {
  incoming: 'Входящий звонок',
  permission: 'Ожидаем доступ к устройствам',
  ringing: 'Звоним…',
  connecting: 'Соединяем…',
  connected: 'На связи',
};
const endText: Record<End['reason'], string> = {
  declined: 'Собеседник отклонил звонок.',
  ended: 'Звонок завершён.',
  missed: 'Собеседник не ответил.',
  disconnected: 'Соединение с собеседником прервалось.',
};

function supportsCalls(): boolean {
  return window.isSecureContext && typeof RTCPeerConnection === 'function' && Boolean(navigator.mediaDevices?.getUserMedia);
}

function callError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Разрешите доступ к микрофону и, для видеозвонка, к камере в настройках браузера.';
    if (error.name === 'NotFoundError') return 'Микрофон или камера не найдены.';
    if (error.name === 'NotReadableError') return 'Микрофон или камера недоступны. Проверьте, не использует ли их другое приложение.';
  }
  return error instanceof Error && !(error instanceof DOMException) ? error.message : 'Не удалось установить звонок.';
}

function stopMedia(stream: MediaStream | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

function callRequest<T extends { ok: true } | ErrorAck>(socket: Socket, event: string, payload: object): Promise<Extract<T, { ok: true }>> {
  return new Promise((resolve, reject) => {
    socket.timeout(6000).emit(event, payload, (error: Error | null, reply?: T) => {
      if (error || !reply) { reject(new Error('Сервер звонков не ответил.')); return; }
      if (!reply.ok) { reject(new Error(reply.error?.message ?? 'Действие недоступно.')); return; }
      resolve(reply as Extract<T, { ok: true }>);
    });
  });
}

export function CallControls({ socket, chat }: { socket: Socket | null; chat: NovaChat | null }) {
  const runtime = useRef<CallRuntime | null>(null);
  const callMenu = useRef<HTMLDetailsElement | null>(null);
  const mediaElement = useRef<HTMLMediaElement | null>(null);
  const [view, setView] = useState<CallView | null>(null);
  const [readySocket, setReadySocket] = useState<Socket | null>(null);
  const ready = socket !== null && socket === readySocket;
  const [notice, setNotice] = useState('');
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const setPhase = useCallback((call: CallRuntime, phase: CallPhase) => {
    if (runtime.current !== call) return;
    call.view = { ...call.view, phase };
    setView(call.view);
  }, []);

  const teardown = useCallback((call: CallRuntime, text = '') => {
    if (runtime.current !== call) return;
    runtime.current = null;
    window.clearTimeout(call.deadline);
    if (call.peer) {
      call.peer.onconnectionstatechange = null;
      call.peer.close();
    }
    stopMedia(call.local);
    stopMedia(call.remote);
    setView(null);
    setLocal(null);
    setRemote(null);
    setMuted(false);
    setCameraOff(false);
    setAudioBlocked(false);
    setNotice(text);
  }, []);

  const end = useCallback((call: CallRuntime, text = '') => {
    if (runtime.current !== call) return;
    if (call.id && call.socket.connected) call.socket.emit('call:end', { callId: call.id });
    teardown(call, text);
  }, [teardown]);

  const handleSignal = useCallback((call: CallRuntime, signal: Signal) => {
    if (!call.peer) {
      if (call.pendingSignals.length < 129) call.pendingSignals.push(signal);
      return;
    }
    const peer = call.peer;
    call.negotiation = (call.negotiation ?? Promise.resolve()).then(async () => {
      if (runtime.current !== call) return;
      if ('candidate' in signal) {
        if (peer.remoteDescription) await peer.addIceCandidate(signal.candidate);
        else if (call.pendingCandidates.length < 128) call.pendingCandidates.push(signal.candidate);
        return;
      }
      await peer.setRemoteDescription(signal.description);
      for (const candidate of call.pendingCandidates.splice(0)) await peer.addIceCandidate(candidate);
      if (signal.description.type === 'offer') {
        await peer.setLocalDescription(await peer.createAnswer());
        if (runtime.current === call && call.socket.connected && peer.localDescription) {
          await callRequest<ReadyAck>(call.socket, 'call:signal', { callId: call.id, description: peer.localDescription.toJSON() });
        }
      }
    }).catch((error: unknown) => end(call, callError(error)));
  }, [end]);

  const createPeer = useCallback((call: CallRuntime) => {
    window.clearTimeout(call.deadline);
    const peer = new RTCPeerConnection({ iceServers: call.iceServers });
    const remoteStream = new MediaStream();
    call.remote = remoteStream;
    call.peer = peer;
    for (const track of call.local?.getTracks() ?? []) peer.addTrack(track, call.local!);
    peer.ontrack = (event) => {
      if (runtime.current !== call) return;
      remoteStream.addTrack(event.track);
      setRemote(remoteStream);
    };
    peer.onicecandidate = (event) => {
      if (event.candidate?.candidate && runtime.current === call && call.socket.connected) {
        call.socket.emit('call:signal', { callId: call.id, candidate: event.candidate.toJSON() });
      }
    };
    peer.onconnectionstatechange = () => {
      if (runtime.current !== call) return;
      if (peer.connectionState === 'failed') end(call, 'Не удалось установить медиасоединение.');
      if (peer.connectionState === 'connected') {
        window.clearTimeout(call.deadline);
        setPhase(call, 'connected');
      }
      if (peer.connectionState === 'disconnected') {
        window.clearTimeout(call.deadline);
        setPhase(call, 'connecting');
        call.deadline = window.setTimeout(() => end(call, 'Медиасоединение прервалось.'), 10_000);
      }
    };
    call.deadline = window.setTimeout(() => end(call, 'Медиасоединение не установилось вовремя.'), 25_000);
    for (const signal of call.pendingSignals.splice(0)) handleSignal(call, signal);
    return peer;
  }, [end, handleSignal, setPhase]);

  const connectOutgoing = useCallback(async (call: CallRuntime, callId: string) => {
    if (runtime.current !== call || call.peer) return;
    setPhase(call, 'connecting');
    try {
      const peer = createPeer(call);
      await peer.setLocalDescription(await peer.createOffer());
      if (runtime.current === call && call.socket.connected && peer.localDescription) {
        await callRequest<ReadyAck>(call.socket, 'call:signal', { callId, description: peer.localDescription.toJSON() });
      }
    } catch (error) {
      end(call, callError(error));
    }
  }, [createPeer, end, setPhase]);

  const takeMedia = async (call: CallRuntime) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: call.view.kind === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 360 } } : false,
    });
    if (runtime.current !== call) {
      stopMedia(stream);
      return false;
    }
    call.local = stream;
    setLocal(stream);
    return true;
  };

  const start = async (kind: CallKind) => {
    if (!socket?.connected || !chat || !ready || runtime.current) return;
    if (callMenu.current) callMenu.current.open = false;
    setNotice('');
    const call: CallRuntime = {
      socket, outgoing: true, view: { phase: 'permission', kind, name: chat.participant.displayName },
      pendingSignals: [], pendingCandidates: [],
    };
    runtime.current = call;
    setView(call.view);
    try {
      if (!await takeMedia(call)) return;
      const ack = await callRequest<StartAck>(socket, 'call:start', { chatId: chat.id, kind });
      call.id = ack.callId;
      call.iceServers = ack.iceServers;
      if (runtime.current !== call) {
        if (socket.connected) socket.emit('call:end', { callId: call.id });
        return;
      }
      if (call.earlyEnd?.callId === call.id) {
        teardown(call, endText[call.earlyEnd.reason]);
        return;
      }
      if (call.earlyAcceptedId === call.id) {
        void connectOutgoing(call, call.id);
        return;
      }
      setPhase(call, 'ringing');
      call.deadline = window.setTimeout(() => end(call, 'Собеседник не ответил.'), 40_000);
    } catch (error) {
      end(call, callError(error));
    }
  };

  const accept = async () => {
    const call = runtime.current;
    if (call?.view.phase !== 'incoming') return;
    setPhase(call, 'permission');
    try {
      if (!await takeMedia(call)) return;
      const ack = await callRequest<StartAck>(call.socket, 'call:accept', { callId: call.id });
      if (runtime.current !== call) return;
      call.iceServers = ack.iceServers;
      setPhase(call, 'connecting');
      createPeer(call);
    } catch (error) {
      end(call, callError(error));
    }
  };

  useEffect(() => {
    if (!socket?.connected || !supportsCalls()) return;
    let live = true;
    const onInvite = (invite: Invite) => {
      if (runtime.current) return;
      setNotice('');
      const call: CallRuntime = {
        id: invite.id, socket, outgoing: false,
        view: { phase: 'incoming', kind: invite.kind, name: invite.caller.displayName },
        pendingSignals: [], pendingCandidates: [],
      };
      runtime.current = call;
      setView(call.view);
    };
    const onAccepted = ({ callId }: { callId: string }) => {
      const call = runtime.current;
      if (!call?.outgoing) return;
      if (!call.id) call.earlyAcceptedId = callId;
      else if (call.id === callId) void connectOutgoing(call, callId);
    };
    const onSignal = (signal: Signal) => {
      const call = runtime.current;
      if (call && call.id === signal.callId) handleSignal(call, signal);
    };
    const onEnded = ({ callId, reason }: End) => {
      const call = runtime.current;
      if (call?.id === callId) teardown(call, endText[reason]);
      else if (call?.outgoing && !call.id) call.earlyEnd = { callId, reason };
    };
    const onDismissed = ({ callId }: { callId: string }) => {
      const call = runtime.current;
      if (call?.id === callId) teardown(call, 'Звонок принят на другом устройстве.');
    };
    const onDisconnect = () => {
      setReadySocket(null);
      if (runtime.current) teardown(runtime.current, 'Связь с сервером звонков потеряна.');
    };
    socket.on('call:invite', onInvite);
    socket.on('call:accepted', onAccepted);
    socket.on('call:signal', onSignal);
    socket.on('call:ended', onEnded);
    socket.on('call:dismissed', onDismissed);
    socket.on('disconnect', onDisconnect);
    void callRequest<ReadyAck>(socket, 'call:ready', {}).then(() => {
      if (live) setReadySocket(socket);
    }).catch(() => {
      if (live) setReadySocket(null);
    });

    return () => {
      live = false;
      socket.off('call:invite', onInvite);
      socket.off('call:accepted', onAccepted);
      socket.off('call:signal', onSignal);
      socket.off('call:ended', onEnded);
      socket.off('call:dismissed', onDismissed);
      socket.off('disconnect', onDisconnect);
      if (runtime.current) end(runtime.current);
    };
  }, [socket, connectOutgoing, end, handleSignal, teardown]);

  const attachRemote = useCallback((element: HTMLMediaElement | null) => {
    mediaElement.current = element;
    if (!element || !remote) return;
    element.srcObject = remote;
    void element.play().catch(() => {
      if (mediaElement.current === element) setAudioBlocked(true);
    });
  }, [remote]);
  const attachLocal = useCallback((element: HTMLVideoElement | null) => {
    if (element && local) element.srcObject = local;
  }, [local]);

  const toggleMicrophone = () => {
    const track = runtime.current?.local?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  };
  const toggleCamera = () => {
    const track = runtime.current?.local?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOff(!track.enabled);
  };

  return (
    <div className={styles.controls}>
      {chat && ready && !view && (
        <details className={styles.menu} ref={callMenu}>
          <summary className="icon-button" aria-label="Звонок" title="Звонок">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M7 3H4a1 1 0 0 0-1 1 17 17 0 0 0 17 17 1 1 0 0 0 1-1v-3l-5-2-2 2a13 13 0 0 1-7-7l2-2z" />
            </svg>
          </summary>
          <div className={styles.menuOptions}>
            <button type="button" className="button" onClick={() => void start('audio')}>Аудиозвонок</button>
            <button type="button" className="button" onClick={() => void start('video')}>Видеозвонок</button>
          </div>
        </details>
      )}
      {(view || notice) && (
        <section className={styles.panel} aria-label="Звонок NOVA">
          {view && (
            <>
              <p className={styles.status} role="status">{phaseText[view.phase]}</p>
              <h2>{view.name}</h2>
              {view.kind === 'video' ? (
                <div className={styles.video}>
                  {remote && <video autoPlay playsInline ref={attachRemote} aria-label="Видео собеседника" />}
                  {local && <video autoPlay muted playsInline ref={attachLocal} aria-label="Предпросмотр камеры" />}
                </div>
              ) : remote && <audio autoPlay ref={attachRemote} />}
              {audioBlocked && (
                <button type="button" className="button" onClick={() => void mediaElement.current?.play().then(() => setAudioBlocked(false)).catch(() => {})}>Включить звук</button>
              )}
              <div className={styles.actions}>
                {view.phase === 'incoming' && <button type="button" className="button" onClick={() => void accept()}>Принять</button>}
                {local && (
                  <button type="button" className="button" aria-pressed={muted} onClick={toggleMicrophone}>
                    {muted ? 'Микрофон выключен' : 'Микрофон включён'}
                  </button>
                )}
                {local && view.kind === 'video' && (
                  <button type="button" className="button" aria-pressed={cameraOff} onClick={toggleCamera}>
                    {cameraOff ? 'Камера выключена' : 'Камера включена'}
                  </button>
                )}
                <button className={styles.end} type="button" onClick={() => { if (runtime.current) end(runtime.current); }}>
                  {view.phase === 'incoming' ? 'Отклонить' : 'Завершить'}
                </button>
              </div>
            </>
          )}
          {notice && (
            <div className={styles.notice}>
              <p role="status">{notice}</p>
              <button type="button" className="icon-button" aria-label="Закрыть уведомление" onClick={() => setNotice('')}>×</button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
