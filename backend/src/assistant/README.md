# Ассистент NOVA

Ассистент использует OpenAI для текста и расшифровки русской речи и Azure Speech для озвучки. Клиенты работают через NOVA API с обычной сессией. История личных чатов и данные профиля к провайдерам не отправляются. Текущие реплики ассистента хранятся в памяти клиента. При ответе клиент передаёт до 11 реплик ассистента и пользователя из текущей беседы.

## Подключение

- В настройках сервера сохраните ключ как `NOVA_AI_OPENAI_KEY`. Можно переопределить `NOVA_AI_CHAT_MODEL` и `NOVA_AI_TRANSCRIPTION_MODEL`, сохранив совместимость с Chat Completions и Audio Transcriptions. [Ключи проекта OpenAI](https://platform.openai.com/api-keys)
- В настройках сервера сохраните ключ и регион Speech как `NOVA_AI_AZURE_SPEECH_KEY` и `NOVA_AI_AZURE_SPEECH_REGION`. Проверьте доступность голосов в выбранном регионе. [Azure Speech](https://portal.azure.com/#create/Microsoft.CognitiveServicesSpeechServices) [Список голосов](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support#text-to-speech)
- Без OpenAI ключа текстовый режим и диктовка недоступны. Двусторонний голосовой режим требует обоих провайдеров. Сайт требует HTTPS или localhost для выдачи разрешения на микрофон. На Android нужен доступ к микрофону.

## Контракт

`GET /api/v1/assistant/status` возвращает признаки серверной конфигурации `chat`, `transcription` и `speech`. Они не проверяют остаток квоты провайдера.

`POST /api/v1/assistant/chat` принимает `{ "messages": [{"role":"user", "content":"Привет"}] }` и возвращает `{"text":"…"}`. Последняя реплика должна иметь роль `user`. До 2000 символов в реплике.

`POST /api/v1/assistant/transcribe` принимает multipart `audio` (AAC в MP4, WebM или Ogg, до 8 МиБ) и возвращает `{"text":"…"}`. В режиме диктовки результат остаётся в поле ввода. В разговоре клиенты используют паузу после речи или ручное завершение реплики, затем повторно включают микрофон после окончания озвучки.

`POST /api/v1/assistant/speech` принимает `{ "text":"…", "voice":"dmitry" }` и возвращает `audio/mpeg`. Голоса `dmitry`, `svetlana` и `dariya` соответствуют русским нейросетевым голосам Microsoft. Запись ограничена 25 секундами на одну реплику в обеих версиях клиента.
