# Slack: исследование функций для проектирования NOVA

**Дата проверки:** 2026-11-15  
**Объект:** только Slack и его официальная документация/официальные материалы.  
**Правило интерпретации:** ниже явно разделены подтверждённые факты Slack и рекомендации/предположения для NOVA. Брендинг и код Slack не копируются.

## 1. Границы исследования

Slack сочетает клиентские функции для рабочих разговоров и платформу API для приложений. Важное архитектурное различие: Slack Events API/Socket Mode доставляют события **Slack-приложению**, а не являются готовым транспортом клиентского чата NOVA. Для NOVA нужно самостоятельно реализовать хранение, авторизацию, синхронизацию клиентов, уведомления и media pipeline.

В официально проверенных источниках я не нашёл подтверждения отдельной функции «stories» в смысле исчезающих пользовательских историй. Поэтому её наличие у Slack для NOVA не утверждается; это отдельная продуктовая гипотеза, которую нужно проектировать и тестировать самостоятельно.

## 2. Подтверждённые функции Slack

### 2.1 Отправка, доставка, история и realtime

- `chat.postMessage` отправляет сообщение в public/private channel или DM; Slack возвращает JSON с `ok`, а при ошибке — машинно-читаемый `error`. Для обычного текста Slack рекомендует держать сообщение коротким: около 4 000 символов; сообщения свыше 40 000 символов могут быть усечены [1].
- Историю разговора получает `conversations.history`. Она поддерживает курсорную и временную пагинацию; максимальный `limit` документации — 999, рекомендованный размер страницы — не более 200. Доступ зависит от типа токена, scopes и членства в разговоре [2].
- В message event есть channel, user, text и уникальный для канала timestamp `ts`. События могут приходить через Events API или legacy RTM; Slack указывает, что RTM-сообщение следует немедленно показывать в клиенте. Для Events API отдельные подписки существуют для public channels, private channels, DM и group DM; приложение видит только разрешённые ему разговоры [3].
- События message имеют подтипы, включая `message_changed`, `message_deleted`, `message_replied` и `file_share`. Скрытые записи edit/delete не возвращаются обычным `conversations.history`; клиенту нужен корректный обработчик событий и reconciliation [3].
- Events API работает через HTTP Request URL или Socket Mode. Slack отправляет событие серверу, ожидает подтверждение, а при проблемах умеет повторять доставку; в Socket Mode события идут по WebSocket, каждое также необходимо подтверждать [4] [5].
- Slack Socket Mode — это транспорт Slack → приложение для событий и интерактивных payloads. Это не замена WebSocket-каналу между приложением NOVA и его мобильными/web-клиентами. В production Slack рекомендует HTTP для более простой горизонтальной масштабируемости; Socket Mode имеет stateful-соединения и лимит до 10 WebSocket-соединений на приложение [6].

### 2.2 Редактирование, удаление и прочтение

- Slack API позволяет приложению обновлять любой не-ephemeral message только в пределах прав токена и обычно только сообщения, опубликованные этим пользователем/ботом. Удаление также ограничено авторством/типом токена; workspace-admin user token имеет более широкие права. Ephemeral messages нельзя обновлять или удалять этими методами [7].
- При человеческом редактировании клиент показывает `(edited)`; для bot-сообщений Slack не показывает этот label. При удалении сообщения ответы в thread могут остаться, а вместо родителя показывается placeholder [7].
- Клиент Slack помечает сообщения прочитанными вскоре после открытия канала или DM. Пользователь может выбрать: начать с места остановки и пометить прочитанным, открыть новейшее и пометить прочитанным или открыть новейшее, оставив невиденные сообщения непрочитанными [8].
- В проверенных официальных API-материалах не подтверждён общий per-user read-receipt API с перечнем пользователей, прочитавших каждое сообщение. Поэтому для NOVA нельзя честно обещать Slack-подобные точные read receipts как уже готовую функцию; их следует реализовать отдельными cursor/receipt-записями только если продукт этого требует.

### 2.3 Push и in-app уведомления, mute

- По умолчанию Slack уведомляет на desktop и mobile; пользователь может выбрать всё или только mentions и DMs, включить desktop/mobile banners и задать channel/DM exceptions [9].
- Настройки включают уведомления о reply в отслеживаемой thread, начале huddle, keyword notifications, звуки, preview текста и расписание паузы. Keywords нечувствительны к регистру, но срабатывают на точное совпадение; keywords в неотслеживаемых threads не уведомляют [9].
- Mute применяется к channel и DM. Замьюченная беседа обычно скрывается из sidebar, но mention, DM и replies в thread могут всё ещё показываться как sidebar signals; доступны временные mute на час или до завтра [10].
- Подтверждённая модель Slack разделяет серверное событие сообщения, in-app Activity/badge и OS-level desktop/mobile notification. Конкретный push transport Slack не является API-контрактом NOVA.

### 2.4 Фото, видео, голос, файлы и истории

- Slack рассматривает файлы как сообщения с дополнительными данными. Файлы можно загрузить и хранить в Slack либо добавить как remote file, размещённый во внешнем хранилище. Для нового upload flow используются `files.getUploadURLExternal`, POST бинарного содержимого и `files.completeUploadExternal`; Slack сканирует загружаемый файл на malware до доступности в workspace [11].
- Официальная справка Slack подтверждает audio/video clips до пяти минут. Пользователь может записать аудио или видео, включить/выключить камеру и микрофон, загрузить существующее видео как clip; для видео доступны captions, а для аудио/видео — transcript generation. Clips удаляются как сообщения/файлы и подчиняются retention policy [12].
- Huddles поддерживают аудио, video, multi-person screen sharing и thread/canvas для заметок. На free plan — максимум 2 участника; на paid plans — до 50, при этом video одновременно включают максимум 25 участников. В huddle одновременно могут делиться экраном до двух людей [13].
- «Фото» в проверенных источниках не выделено отдельным объектом: практически это image file/clip, проходящий общий file upload/share flow. Отдельной официально подтверждённой функции disappearing stories не найдено.

### 2.5 Звонки и realtime

- Huddles — встроенный realtime voice/video/screen-sharing сценарий, который можно начать в channel или DM; участники могут приглашать людей извне исходного разговора, но приглашённые не получают автоматически доступ к истории канала/DM [13].
- Для NOVA это означает две разные задачи: signaling/presence/chat events и media plane. WebSocket/Socket.IO решает signaling и события, но не заменяет передачу аудио/видео через WebRTC, TURN и SFU.
- Slack Calls API в текущем наборе официальных материалов не использован как основание для функции NOVA; проектировать собственные звонки следует через стандартный WebRTC и выбранный media server, а не через предположение, что Slack API даст media routing.

### 2.6 Приватность и безопасность

- Slack заявляет шифрование customer data at rest и in transit по умолчанию. Дополнительные enterprise controls включают EKM, audit logs, DLP, legal holds, eDiscovery, retention policies и data residency [14].
- Web API требует HTTPS и TLS 1.2 или выше; токены нужно передавать безопасно, не публиковать в репозиториях и предпочтительно передавать Bearer header [15].
- Events API привязан к OAuth scopes и перспективе авторизовавшего пользователя/бота: приложение получает только то, что этот installation может видеть. Для NOVA аналогично обязательны server-side ACL на workspace/channel/DM и проверка прав для каждого чтения и изменения [4].
- Retention в Slack на paid plans по умолчанию сохраняет данные на lifetime workspace, но администратор может настроить автоматическое удаление. На free plan доступны 90 дней или один год; удаления выполняются примерно раз в день и являются постоянными. Политика распространяется на messages, files, canvases и lists, включая pinned/saved content [16].

## 3. Ограничения и операционные зависимости

- Общие Web API tiers Slack: Tier 1 — 1+ request/min, Tier 2 — 20+, Tier 3 — 50+, Tier 4 — 100+; действуют per-method/per-workspace/per-app. `chat.postMessage` обычно ограничен примерно одним сообщением в секунду на канал. Events API ограничен примерно 30 000 доставок на workspace/app за 60 минут; при 429 Slack выдаёт `Retry-After` [17].
- Для новых коммерчески распространяемых приложений вне Slack Marketplace с 29 мая 2025 `conversations.history` и `conversations.replies` имеют более жёсткие ограничения: 1 request/min и максимум 15 объектов на запрос. Это операционный риск при миграциях/интеграциях и причина не строить синхронизацию на полном частом polling [2] [17].
- В Slack Socket Mode соединения нужно подтверждать, обновлять и восстанавливать; stateful WebSockets сложнее масштабировать. Для NOVA аналогично требуются idempotency keys, event sequence/cursor, reconnect, backoff, duplicate suppression и фоновые retry workers.
- Размер/тип media, malware scanning, transcoding, thumbnails, transcripts, captions, retention deletion и exports являются отдельными операционными контурами. Нельзя считать их побочным эффектом PostgreSQL или Socket.IO.

## 4. Рекомендации по стеку NOVA

### 4.1 Kotlin/Compose

- Модель сообщения в Android должна иметь стабильный `messageId`, `conversationId`, `senderId`, `clientCreatedAt`, `serverCreatedAt`, `version`, `editedAt`, `deletedAt`, `replyToId`, delivery state и attachment references.
- Использовать optimistic send: локально `pending`, затем `accepted`, `delivered`, `read` только при наличии собственных серверных receipt semantics. Повторная отправка должна быть безопасной через client-generated idempotency key.
- Compose UI следует строить вокруг paging/history cursor, offline cache и event reducer. Edit/delete должны быть version-aware, чтобы позднее событие не перетёрло более новую редакцию.
- OS push не должен зависеть от открытого Socket.IO: при фоне приложение получает push, открывает conversation и догружает authoritative state с NestJS.

### 4.2 Next.js

- Использовать Next.js для web-клиента и серверного rendering shell, но не как единственный realtime broker. Клиент подключается к NestJS Socket.IO namespace/room после server-side auth.
- Уведомления в браузере разделить на in-app Activity и Web Push permission/token. Текст preview должен уважать mute, privacy settings и отсутствие доступа к разговору.
- Для attachments web-клиент получает short-lived upload URL от NestJS, загружает напрямую в object storage и только после успешного finalize создаёт message attachment.

### 4.3 NestJS

- Выделить модули: Auth/ACL, Conversations, Messages, Receipts, Notifications, Media, Calls/Signaling, Moderation и Audit.
- HTTP API: cursor pagination для history, `POST /messages`, `PATCH /messages/:id`, soft-delete/event tombstone, attachment finalize. Socket.IO: rooms per conversation, presence, typing, message events и call signaling; важные операции всё равно подтверждаются сервером и записываются в PostgreSQL.
- Ввести outbox pattern: транзакция PostgreSQL пишет message/event/outbox, worker публикует Socket.IO event и ставит push job. Это предотвращает ситуацию «клиент получил событие, но запись потерялась».
- Проверять ACL и membership на каждой операции, не доверять conversationId из клиента. События edit/delete должны быть идемпотентны и иметь monotonic version.

### 4.4 PostgreSQL

- Базовые сущности: `users`, `conversations`, `conversation_members`, `messages`, `message_revisions` или audit JSONB, `attachments`, `message_receipts`, `notification_preferences`, `device_tokens`, `outbox_events`, `jobs`, `call_sessions`.
- Индексы: `(conversation_id, created_at, id)`, partial index для не deleted сообщений, membership `(conversation_id,user_id)`, unread cursor per member. Для retention использовать scheduled deletion batches, но сохранять audit/legal-hold semantics только если это явно требуется политикой NOVA.
- Не хранить бинарные фото/видео/аудио в PostgreSQL как основной media store; хранить metadata, object key, checksum, MIME, byte size, scan/transcode status и access policy.

### 4.5 Socket.IO и Redis

- Socket.IO — подходящий application realtime layer для NOVA text events, typing, presence и signaling. Redis adapter нужен для нескольких NestJS instances; Redis Streams/BullMQ — для durable jobs и fan-out, а не только ephemeral pub/sub.
- Presence и typing должны иметь TTL и не становиться permanent truth в PostgreSQL. Message delivery/read receipts, напротив, должны иметь durable representation или cursor.
- Для reconnect клиент запрашивает события после last-seen sequence либо делает history reconciliation; нельзя полагаться на то, что WebSocket доставит всё во время offline.

### 4.6 GitHub Actions

- CI должен запускать Kotlin unit/UI tests, Next.js/NestJS typecheck/lint/tests, migration checks, OpenAPI/event-schema compatibility и security/dependency scanning.
- Отдельные integration jobs поднимают PostgreSQL и Redis, тестируют duplicate events, reconnect, outbox retry, rate limits и media finalize failures.
- CD мигрирует PostgreSQL до rollout, проверяет health/readiness и имеет rollback-safe миграции. Media/worker/call services следует деплоить независимо от web API, иначе длинные transcode/push jobs будут блокировать web traffic.

## 5. Что нельзя честно добавить без зависимостей

- **Без media storage** нельзя обещать надёжные фото, видео, голосовые, вложения, thumbnails, скачивание, retention и безопасные short-lived URLs. PostgreSQL хранит ссылки и metadata, но не заменяет object storage/CDN.
- **Без push provider** нельзя обещать настоящие фоновые mobile push-уведомления на Android/iOS. Socket.IO работает только пока клиент имеет живое соединение; для background delivery нужны FCM/APNs или эквивалентный провайдер и таблица device tokens.
- **Без TURN/SFU** нельзя честно обещать production-grade групповые аудио/видео звонки и screen sharing. WebRTC может работать в простых сетях peer-to-peer, но NAT/firewall traversal требует TURN, а масштабирование группы — SFU/media server.
- **Без фоновых workers** нельзя надёжно добавить malware scan orchestration, transcoding, thumbnails, transcription/captions, push dispatch, retry/backoff, retention deletion, export и cleanup orphaned uploads. HTTP request не должен удерживаться для таких операций.
- **Без Redis или другого межпроцессного coordination layer** нельзя безопасно масштабировать Socket.IO rooms/presence между несколькими инстансами; локальная память одного процесса не является общей realtime-инфраструктурой.
- **Без durable event/outbox model** нельзя гарантировать согласованность между записью сообщения в PostgreSQL, realtime broadcast и push. «Emit после save» без retry/reconciliation создаёт окна потери уведомлений.

## 6. Итоговые решения для MVP NOVA

1. Сначала сделать text/threads/edit/delete/soft-delete, cursor history, optimistic UI, in-app notifications, mute, unread cursor и собственные read receipts как отдельную опциональную модель.
2. Затем подключить object storage + scan worker для фото/файлов и ограниченные audio/video clips. Не называть это stories, пока не определены retention, audience, expiry и moderation semantics.
3. Реaltime calls выпускать отдельным этапом после выбора TURN/SFU-провайдера и threat model для microphone/camera/screen capture.
4. С самого начала заложить ACL, audit trail, retention configuration, token/device security, outbox, idempotency и GitHub Actions integration tests; эти свойства сложнее добавить после появления нескольких клиентов.

## References

[1]: https://api.slack.com/methods/chat.postMessage "chat.postMessage method"
[2]: https://api.slack.com/methods/conversations.history "conversations.history method"
[3]: https://api.slack.com/events/message "message event"
[4]: https://api.slack.com/events-api "The Events API"
[5]: https://api.slack.com/apis/socket-mode "Using Socket Mode"
[6]: https://api.slack.com/apis/event-delivery "Comparing HTTP & Socket Mode"
[7]: https://api.slack.com/messaging/modifying "Modifying messages"
[8]: https://slack.com/help/articles/360043037853-Manage-your-Mark-as-Read-preference "Manage your Mark as Read preference"
[9]: https://slack.com/help/articles/201355156-Configure-your-Slack-notifications "Configure your Slack notifications"
[10]: https://slack.com/help/articles/204411433-Mute-channels-and-direct-messages "Mute channels and direct messages"
[11]: https://api.slack.com/messaging/files "Working with files"
[12]: https://slack.com/help/articles/4406235165587-Record-audio-and-video-clips-in-Slack "Record audio and video clips in Slack"
[13]: https://slack.com/help/articles/4402059015315-Use-huddles-in-Slack "Use huddles in Slack"
[14]: https://slack.com/trust/security "Security, Encryption, and Compliance at Slack"
[15]: https://api.slack.com/web "Slack Web API"
[16]: https://slack.com/help/articles/203457187-Customize-data-retention-in-Slack "Customize data retention in Slack"
[17]: https://api.slack.com/apis/rate-limits "Rate limits"
