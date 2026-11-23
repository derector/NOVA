'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { API_BASE_URL, apiPath } from '@/lib/api';
import styles from './NovaAssistant.module.css';

type Turn = { role: 'user' | 'assistant'; content: string };
type Capabilities = { chat: boolean; transcription: boolean; speech: boolean };
type Phase = 'idle' | 'permission' | 'recording' | 'transcribing' | 'thinking' | 'speaking';
type Recording = { stop: (cancel?: boolean) => void };

const labels: Record<Phase, string> = {
  idle: 'Помощник NOVA',
  permission: 'Открываю микрофон…',
  recording: 'Слушаю…',
  transcribing: 'Расшифровываю…',
  thinking: 'Готовлю ответ…',
  speaking: 'Отвечаю голосом…',
};

function watchSpeech(stream: MediaStream, stop: () => void) {
  if (typeof AudioContext === 'undefined') return () => {};
  let context: AudioContext | undefined;
  try {
    context = new AudioContext();
    void context.resume().catch(() => {});
    const input = context.createMediaStreamSource(stream);
    const meter = context.createAnalyser();
    input.connect(meter);
    const samples = new Uint8Array(meter.fftSize);
    let lastSpeech: number | undefined;
    const timer = window.setInterval(() => {
      meter.getByteTimeDomainData(samples);
      let energy = 0;
      for (const sample of samples) energy += ((sample - 128) / 128) ** 2;
      if (Math.sqrt(energy / samples.length) >= 0.024) lastSpeech = performance.now();
      if (lastSpeech && performance.now() - lastSpeech > 1_050) stop();
    }, 100);
    return () => { window.clearInterval(timer); input.disconnect(); void context?.close().catch(() => {}); };
  } catch {
    void context?.close().catch(() => {});
    return () => {};
  }
}

export default function NovaAssistant({ accessToken }: { accessToken: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const messagesEnd = useRef<HTMLDivElement>(null);
  const recording = useRef<Recording | null>(null);
  const request = useRef<AbortController | null>(null);
  const attempt = useRef(0);
  const audio = useRef<HTMLAudioElement>(null);
  const audioUrl = useRef('');
  const operation = useRef<Phase>('idle');
  const voiceLoop = useRef(false);
  const [open, setOpen] = useState(false);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [voice, setVoice] = useState('dmitry');
  const [live, setLive] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [hasAudio, setHasAudio] = useState(false);

  function setActivity(next: Phase) { operation.current = next; setPhase(next); }

  function stop() {
    voiceLoop.current = false;
    setLive(false);
    attempt.current += 1;
    request.current?.abort();
    request.current = null;
    recording.current?.stop(true);
    audio.current?.pause();
    setActivity('idle');
  }

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`${API_BASE_URL}${apiPath('/assistant/status')}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
      cache: 'no-store',
    }).then(async (response) => {
      if (!response.ok) throw new Error('Не удалось подключить помощника. Повторите попытку.');
      const result = await response.json() as Capabilities;
      if (!controller.signal.aborted) setCaps(result);
    }).catch(() => {
      if (!controller.signal.aborted) {
        setCaps({ chat: false, transcription: false, speech: false });
        setError('Не удалось подключить помощника. Откройте окно снова.');
      }
    });
    return () => controller.abort();
  }, [accessToken, open]);

  useEffect(() => () => {
    attempt.current += 1;
    request.current?.abort();
    recording.current?.stop(true);
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
  }, []);

  useEffect(() => { messagesEnd.current?.scrollIntoView({ block: 'nearest' }); }, [turns]);

  async function send(path: string, body: FormData | object, signal: AbortSignal) {
    const headers = new Headers({ Authorization: `Bearer ${accessToken}` });
    if (!(body instanceof FormData)) headers.set('Content-Type', 'application/json');
    const response = await fetch(`${API_BASE_URL}${apiPath(`/assistant/${path}`)}`, {
      method: 'POST',
      headers,
      body: body instanceof FormData ? body : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.any([signal, AbortSignal.timeout(35_000)]),
    });
    if (response.status === 401) throw new Error('Сессия истекла. Войдите снова.');
    if (response.status === 429) throw new Error('Лимит запросов помощника исчерпан. Попробуйте позже.');
    if (!response.ok) throw new Error('Сервис помощника временно недоступен. Попробуйте ещё раз.');
    return response;
  }

  async function speak(text: string, controller: AbortController) {
    audio.current?.pause();
    setHasAudio(false);
    setActivity('speaking');
    const response = await send('speech', { text, voice }, controller.signal);
    const clip = await response.blob();
    if (controller.signal.aborted || !audio.current) return;
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
    audioUrl.current = URL.createObjectURL(clip);
    audio.current.src = audioUrl.current;
    setHasAudio(true);
    try { await audio.current.play(); }
    catch {
      if (!controller.signal.aborted) setError('Браузер остановил автозапуск. Нажмите «Воспроизвести» на аудиоплеере.');
    }
  }

  async function converse(text: string, history: Turn[], vocal: boolean, controller: AbortController) {
    if (!text.trim() || text.length > 2000) throw new Error('Введите сообщение от 1 до 2000 символов.');
    const userTurn: Turn = { role: 'user', content: text.trim() };
    const next = [...history, userTurn];
    setActivity('thinking');
    const response = await send('chat', { messages: next.slice(-11) }, controller.signal);
    const result = await response.json() as { text: string };
    if (controller.signal.aborted) return;
    setTurns([...next, { role: 'assistant', content: result.text }]);
    setInput('');
    if (vocal) await speak(result.text, controller);
  }

  function fail(reason: unknown, controller: AbortController) {
    if (controller.signal.aborted) return;
    setError(reason instanceof Error ? reason.message : 'Не удалось выполнить запрос.');
    stop();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!caps?.chat || !input.trim() || operation.current !== 'idle') return;
    setError('');
    const controller = new AbortController();
    request.current = controller;
    try { await converse(input, turns, false, controller); }
    catch (reason) { fail(reason, controller); }
    finally { if (!controller.signal.aborted) setActivity('idle'); }
  }

  async function listen(vocal: boolean, history: Turn[]) {
    if (!caps?.transcription || operation.current !== 'idle') return;
    setError('');
    setActivity('permission');
    const id = ++attempt.current;
    let stream: MediaStream | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Запись недоступна в этом браузере. Откройте NOVA по HTTPS в современном браузере.');
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      if (id !== attempt.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const media = stream;
      const pieces: Blob[] = [];
      let cancelled = false;
      let stopped = false;
      let timer = 0;
      let cleanupSpeech = () => {};

      function stopRecording(cancel = false) {
        cancelled ||= cancel;
        if (stopped) return;
        stopped = true;
        clearTimeout(timer);
        cleanupSpeech();
        if (recorder.state !== 'inactive') recorder.stop();
        media.getTracks().forEach((track) => track.stop());
        if (recording.current?.stop === stopRecording) recording.current = null;
      }

      recorder.ondataavailable = (event) => { if (event.data.size) pieces.push(event.data); };
      recorder.onerror = () => {
        stopRecording(true);
        setError('Не удалось записать звук. Проверьте подключение микрофона.');
        stop();
      };
      recorder.onstop = async () => {
        if (cancelled || id !== attempt.current) return;
        const controller = new AbortController();
        request.current = controller;
        setActivity('transcribing');
        try {
          const file = new Blob(pieces, { type: recorder.mimeType });
          if (!file.size) throw new Error('Запись пуста. Попробуйте ещё раз.');
          const form = new FormData();
          form.set('audio', file, 'recording');
          const response = await send('transcribe', form, controller.signal);
          const { text } = await response.json() as { text: string };
          if (controller.signal.aborted) return;
          if (!text.trim()) throw new Error('Речь не распознана. Попробуйте ещё раз.');
          if (vocal) {
            setInput(text);
            await converse(text, history, true, controller);
          } else {
            setInput((current) => [current.trim(), text.trim()].filter(Boolean).join(' ').slice(0, 2000));
            setActivity('idle');
          }
        } catch (reason) { fail(reason, controller); }
      };

      recorder.start();
      recording.current = { stop: stopRecording };
      timer = window.setTimeout(() => stopRecording(), 25_000);
      if (vocal) cleanupSpeech = watchSpeech(stream, stopRecording);
      setActivity('recording');
    } catch (reason) {
      stream?.getTracks().forEach((track) => track.stop());
      if (id !== attempt.current) return;
      stop();
      setError(reason instanceof DOMException && reason.name === 'NotAllowedError'
        ? 'Разрешите доступ к микрофону в настройках браузера.'
        : reason instanceof Error ? reason.message : 'Микрофон недоступен.');
    }
  }

  function startVoice() {
    if (!caps?.chat || !caps.transcription || !caps.speech || operation.current !== 'idle') return;
    voiceLoop.current = true;
    setLive(true);
    void listen(true, turns);
  }

  async function readReply(text: string) {
    if (!caps?.speech || operation.current !== 'idle') return;
    audio.current?.pause();
    setError('');
    const controller = new AbortController();
    request.current = controller;
    try { await speak(text, controller); }
    catch (reason) { fail(reason, controller); }
  }

  function speechEnded() {
    if (operation.current !== 'speaking') return;
    setActivity('idle');
    if (voiceLoop.current) void listen(true, turns);
  }

  return (
    <>
      <button className="icon-button" type="button" onClick={() => {
        setCaps(null);
        setError('');
        dialog.current?.showModal();
        setOpen(true);
      }}>Ассистент</button>
      <dialog ref={dialog} className={`glass-dialog ${styles.dialog}`} aria-labelledby="nova-assistant-title" onClose={() => { stop(); setOpen(false); }}>
        <header className={styles.header}>
          <div>
            <h2 id="nova-assistant-title">Ассистент NOVA</h2>
            <p role="status">{caps ? labels[phase] : 'Подключаю помощника…'}</p>
          </div>
          <button className="icon-button" type="button" aria-label="Закрыть помощника" onClick={() => dialog.current?.close()}>×</button>
        </header>
        <div className={styles.controls}>
          <button className="icon-button" type="button" disabled={!live && (!caps?.chat || !caps.transcription || !caps.speech || phase !== 'idle')} onClick={live ? stop : startVoice}>
            {live ? 'Завершить разговор' : 'Голосовой разговор'}
          </button>
          <label>Голос <select value={voice} disabled={phase !== 'idle' || !caps?.speech} onChange={(event) => setVoice(event.target.value)}>
            <option value="dmitry">Дмитрий</option>
            <option value="svetlana">Светлана</option>
            <option value="dariya">Дарья</option>
          </select></label>
        </div>
        <section className={styles.thread} role="log" aria-label="Беседа с помощником">
          {caps?.chat && turns.length === 0 && <p className={styles.intro}>Напишите ваш вопрос или запишите его голосом.</p>}
          {caps && !caps.chat && !error && <p>Помощник недоступен. Для его работы требуется подключить сервис ИИ.</p>}
          {turns.map((turn, index) => (
            <article className={turn.role === 'user' ? styles.user : styles.reply} key={index}>
              <p>{turn.content}</p>
              {turn.role === 'assistant' && caps?.speech && <button className="icon-button" type="button" disabled={phase !== 'idle'} onClick={() => void readReply(turn.content)}>Озвучить</button>}
            </article>
          ))}
          <div ref={messagesEnd} />
        </section>
        <p className={styles.error} role="alert">{error}</p>
        <audio ref={audio} className={styles.audio} hidden={!hasAudio} controls aria-label="Воспроизвести голосовой ответ" onEnded={speechEnded} onError={() => {
          if (!audioUrl.current) return;
          setError('Не удалось воспроизвести голосовой ответ.');
          stop();
        }} />
        <form className={styles.composer} onSubmit={submit}>
          <button className="icon-button" type="button" disabled={!caps?.transcription || (phase !== 'idle' && phase !== 'recording')} onClick={() => {
            if (recording.current) recording.current.stop();
            else void listen(false, turns);
          }}>{phase === 'recording' ? 'Готово' : 'Диктовать'}</button>
          <textarea rows={1} maxLength={2000} aria-label="Сообщение помощнику" placeholder="Вопрос для NOVA" value={input} onChange={(event) => setInput(event.target.value)} disabled={!caps?.chat || phase !== 'idle'} />
          <button className="icon-button" disabled={!caps?.chat || phase !== 'idle' || !input.trim()} type="submit">Отправить</button>
        </form>
        <p className={styles.privacy}>Вопросы и голосовая запись обрабатываются сервисами ИИ. Переписка из чатов помощнику недоступна.</p>
      </dialog>
    </>
  );
}
