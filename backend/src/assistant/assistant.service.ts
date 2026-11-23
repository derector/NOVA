import { BadGatewayException, BadRequestException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DatabaseService } from '../database/database.module';
import { voices, type SpeechDto, type TurnDto } from './assistant.dto';

export const audioLimit = 8 * 1024 * 1024;
const openAi = 'https://api.openai.com/v1';
const xmlEntities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;' };

function audioFormat(data: Buffer): { type: string; extension: string } {
  if (data.length > 12 && data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { type: 'audio/webm', extension: 'webm' };
  }
  if (data.length > 12 && data.toString('ascii', 4, 8) === 'ftyp') {
    return { type: 'audio/mp4', extension: 'm4a' };
  }
  if (data.length > 12 && data.toString('ascii', 0, 4) === 'OggS') {
    return { type: 'audio/ogg', extension: 'ogg' };
  }
  throw new BadRequestException('Unsupported audio format');
}

@Injectable()
export class AssistantService {
  constructor(private readonly db: DatabaseService) {}

  status() {
    const openAiConfigured = Boolean(process.env.NOVA_AI_OPENAI_KEY?.trim());
    return { chat: openAiConfigured, transcription: openAiConfigured, speech: Boolean(this.azure) };
  }

  async chat(userId: string, messages: TurnDto[]): Promise<{ text: string }> {
    const headers = this.openAiHeaders();
    if (messages.at(-1)?.role !== 'user' || messages.some((turn) => typeof turn?.content !== 'string' || !turn.content.trim())) {
      throw new BadRequestException('The conversation must end with a user message');
    }
    await this.limit(userId, 'chat', 50);
    const result = await this.request(`${openAi}/chat/completions`, {
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.NOVA_AI_CHAT_MODEL?.trim() || 'gpt-4o-mini',
        max_completion_tokens: 650,
        messages: [{
          role: 'system',
          content: 'Ты помощник NOVA. Отвечай по-русски ясным естественным языком, обычно не более 4 коротких предложений. Ответ будут озвучивать: не используй Markdown и таблицы. У тебя нет доступа к чужим чатам или управлению приложением.',
        }, ...messages.map(({ role, content }) => ({ role, content: content.trim() }))],
      }),
    });
    const payload = await this.readJson(result) as { choices?: { message?: { content?: unknown } }[] } | null;
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new BadGatewayException('Assistant returned an empty response');
    return { text: content.trim().slice(0, 2000) };
  }

  async transcribe(userId: string, audio?: Buffer): Promise<{ text: string }> {
    const headers = this.openAiHeaders();
    if (!audio?.length || audio.length > audioLimit) throw new BadRequestException('Incomplete audio upload');
    const format = audioFormat(audio);
    await this.limit(userId, 'transcription', 80);
    const body = new FormData();
    body.set('model', process.env.NOVA_AI_TRANSCRIPTION_MODEL?.trim() || 'gpt-4o-mini-transcribe');
    body.set('language', 'ru');
    body.set('file', new Blob([Uint8Array.from(audio)], { type: format.type }), `recording.${format.extension}`);
    const result = await this.request(`${openAi}/audio/transcriptions`, { headers, body });
    const payload = await this.readJson(result) as { text?: unknown } | null;
    if (typeof payload?.text !== 'string') throw new BadGatewayException('Transcription service returned an invalid response');
    return { text: payload.text.trim().slice(0, 2000) };
  }

  async speech(userId: string, { text, voice }: SpeechDto): Promise<Buffer> {
    const azure = this.azure;
    if (!azure) throw new ServiceUnavailableException('Neural speech is not configured');
    if (!text.trim()) throw new BadRequestException('Speech text is empty');
    await this.limit(userId, 'speech', 100);
    const escaped = text.replace(/[&<>]/g, (character) => xmlEntities[character]).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/g, '');
    const result = await this.request(`https://${azure.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      headers: {
        'Ocp-Apim-Subscription-Key': azure.key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'NOVA-Assistant',
      },
      body: `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="ru-RU"><voice name="${voices[voice]}">${escaped}</voice></speak>`,
    });
    if (!/^audio\/(mpeg|mp3)(;|$)/i.test(result.headers.get('content-type') ?? '')) {
      await result.body?.cancel();
      throw new BadGatewayException('Neural speech returned invalid audio');
    }
    try {
      const buffer = Buffer.from(await result.arrayBuffer());
      if (buffer.length && buffer.length <= audioLimit) return buffer;
    } catch { /* Network or provider errors must not expose configuration. */ }
    throw new BadGatewayException('Neural speech returned invalid audio');
  }

  private get azure() {
    const key = process.env.NOVA_AI_AZURE_SPEECH_KEY?.trim();
    const region = process.env.NOVA_AI_AZURE_SPEECH_REGION?.trim();
    return key && region && /^[a-z][a-z0-9]{1,31}$/.test(region) ? { key, region } : undefined;
  }

  private openAiHeaders(): Record<string, string> {
    const key = process.env.NOVA_AI_OPENAI_KEY?.trim();
    if (!key) throw new ServiceUnavailableException('Assistant is not configured');
    return { Authorization: `Bearer ${key}` };
  }

  private async request(url: string, options: RequestInit): Promise<Response> {
    try {
      const response = await fetch(url, { ...options, method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30_000) });
      if (response.ok) return response;
      await response.body?.cancel();
    } catch { /* Provider details and credentials never go to the client. */ }
    throw new BadGatewayException('Assistant provider is temporarily unavailable');
  }

  private async readJson(response: Response): Promise<unknown> {
    try { return await response.json(); }
    catch { throw new BadGatewayException('Assistant provider returned an invalid response'); }
  }

  private async limit(userId: string, action: string, limit: number): Promise<void> {
    const key = createHash('sha256').update(`nova-assistant:${action}:${userId}`).digest('hex');
    const { rows } = await this.db.query<{ hit_count: number }>(
      `INSERT INTO rate_limit_buckets (bucket_key, window_started_at, hit_count)
        VALUES ($1, date_trunc('hour', now()), 1)
       ON CONFLICT (bucket_key) DO UPDATE SET
        hit_count = CASE WHEN rate_limit_buckets.window_started_at < excluded.window_started_at THEN 1 ELSE rate_limit_buckets.hit_count + 1 END,
        window_started_at = excluded.window_started_at
       RETURNING hit_count`, [key],
    );
    if (rows[0].hit_count > limit) throw new HttpException('Assistant rate limit reached', HttpStatus.TOO_MANY_REQUESTS);
  }
}
