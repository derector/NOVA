import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { AssistantService } from '../src/assistant/assistant.service';
import type { DatabaseService } from '../src/database/database.module';

test('assistant uses only configured providers and isolates client prompts and voice text', async (context) => {
  const keys = ['NOVA_AI_OPENAI_KEY', 'NOVA_AI_AZURE_SPEECH_KEY', 'NOVA_AI_AZURE_SPEECH_REGION'] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  context.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
  for (const key of keys) delete process.env[key];

  const database = { query: async () => ({ rows: [{ hit_count: 1 }] }) } as unknown as DatabaseService;
  const assistant = new AssistantService(database);
  assert.deepEqual(assistant.status(), { chat: false, transcription: false, speech: false });
  await assert.rejects(assistant.chat('owner', [{ role: 'user', content: 'Привет' }]), /not configured/);

  process.env.NOVA_AI_OPENAI_KEY = 'openai-test-key';
  process.env.NOVA_AI_AZURE_SPEECH_KEY = 'azure-test-key';
  process.env.NOVA_AI_AZURE_SPEECH_REGION = 'westeurope';
  const calls = context.mock.method(globalThis, 'fetch', async (target: string, options: RequestInit) => {
    const url = new URL(target);
    const headers = new Headers(options.headers);
    assert.equal(options.redirect, 'error');
    if (url.pathname === '/v1/chat/completions') {
      assert.equal(url.hostname, 'api.openai.com');
      assert.equal(headers.get('authorization'), 'Bearer openai-test-key');
      const { messages } = JSON.parse(String(options.body));
      assert.deepEqual(messages.slice(1), [{ role: 'user', content: 'Привет' }]);
      return Response.json({ choices: [{ message: { content: 'Привет! Чем помочь?' } }] });
    }
    if (url.pathname === '/v1/audio/transcriptions') {
      assert.equal(url.hostname, 'api.openai.com');
      const body = options.body as FormData;
      assert.equal(body.get('language'), 'ru');
      const upload = body.get('file') as File;
      assert.equal(upload.type, 'audio/mp4');
      assert.equal(upload.name, 'recording.m4a');
      return Response.json({ text: ' Добрый день! ' });
    }
    assert.equal(url.hostname, 'westeurope.tts.speech.microsoft.com');
    assert.equal(headers.get('ocp-apim-subscription-key'), 'azure-test-key');
    assert.match(String(options.body), /ru-RU-DmitryNeural/);
    assert.match(String(options.body), /&lt;это&gt; &amp; то/);
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg' } });
  });

  assert.deepEqual(assistant.status(), { chat: true, transcription: true, speech: true });
  await assert.rejects(assistant.chat('owner', [{ role: 'assistant', content: 'Привет' }]), /end with a user message/);
  await assert.rejects(assistant.transcribe('owner', Buffer.from('not audio')), /Unsupported audio/);
  assert.deepEqual(await assistant.chat('owner', [{ role: 'user', content: ' Привет ' }]), { text: 'Привет! Чем помочь?' });
  assert.deepEqual(await assistant.transcribe('owner', Buffer.from('1234ftyp12345')), { text: 'Добрый день!' });
  assert.deepEqual(await assistant.speech('owner', { voice: 'dmitry', text: '<это> & то' }), Buffer.from([1, 2, 3]));
  assert.equal(calls.mock.callCount(), 3);
});
