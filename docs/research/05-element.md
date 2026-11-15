# Element / Matrix для проектирования NOVA

## Область и статус утверждений

Ниже исследуется только Matrix и официальные проекты Element/Matrix. Формулировки «Подтверждено» опираются на спецификации или официальные репозитории. Формулировки «Рекомендация NOVA» — проектный вывод для заданного стека и не являются обещанием возможностей Matrix.

Matrix — это набор открытых API для федеративной синхронизации событий между клиентами, homeserver-ами и сервисами. Homeserver хранит историю и аккаунты, а комнаты реплицируются между homeserver-ами участников; модель согласованности — eventual consistency, а не единая транзакционная база всех клиентов. [1]

## 1. Сообщения: отправка, доставка, прочтение, редактирование и удаление

### Подтверждено

- Базовая единица Matrix — событие в комнате. Текст обычно отправляется как `m.room.message` с типом содержимого `m.text`. Client-Server API предоставляет `PUT /_matrix/client/v3/rooms/{roomId}/send/{eventType}/{txnId}` для отправки события и `GET /_matrix/client/v3/sync` для получения изменений. Идентификатор транзакции клиента делает повторную отправку идемпотентной на API-уровне. [1]
- Официальный `matrix-js-sdk` поддерживает `/sync`, local echo (сообщение сразу видно как «отправляется»), состояния failed/sent, повтор запросов при сетевых и rate-limit ошибках, очередь отправки и пагинацию. Это поведение SDK, а не обещание, что удалённый получатель уже получил сообщение. [3]
- Matrix не задаёт единственный глобальный момент «доставлено». Практическая цепочка должна различать: локальное состояние клиента; принятие события homeserver-ом; поступление события в `/sync` другого клиента; read receipt/read marker. Межсерверная доставка и порядок могут быть eventual-consistent вследствие федерации. [1]
- Для прочтения есть receipts: `POST /_matrix/client/v3/rooms/{roomId}/receipt/{receiptType}/{eventId}`. Отдельно есть `POST /_matrix/client/v3/rooms/{roomId}/read_markers`; в `/sync` receipts передаются как ephemeral events, включая `m.receipt`. Поэтому NOVA может реализовать single/double check как UI-слой над отправкой, синхронизацией и receipt, но нельзя называть отправку доказательством прочтения. [2]
- Печать поддерживается отдельным endpoint `PUT /_matrix/client/v3/rooms/{roomId}/typing/{userId}` и обычно приходит как ephemeral `m.typing`. Это realtime-состояние, а не сообщение истории. [2]
- Редактирование реализуется новым событием-отношением к исходному событию (`m.replace`/отношения), а не перезаписью уже распространённого события. Удаление — redaction через `PUT /_matrix/client/v3/rooms/{roomId}/redact/{eventId}/{txnId}`. Redaction удаляет/скрывает доступное содержимое согласно правилам комнаты, но не гарантирует уничтожение уже скачанных, закэшированных или виденных копий на всех клиентах и homeserver-ах. [1]
- Официальный SDK предоставляет высокоуровневый объект событий/комнат и обработку входящих timeline events. При его использовании клиент обязан валидировать содержимое событий: спецификация прямо считает event body недоверенными данными. [1] [3]

### Ограничения и вывод для NOVA

В доменной модели NOVA не смешивать `message_id`, `event_id`, `client_transaction_id`, `delivery_state` и `read_receipt`. Рекомендуемые состояния: `queued`, `sending`, `accepted_by_homeserver`, `synced_to_device`, `read`, `failed`, `redacted`. Последние два устройства одного пользователя могут дать разные локальные наблюдения; серверное состояние нужно считать источником для межустройственной синхронизации.

Если NOVA не строит полноценный Matrix homeserver, NestJS должен быть адаптером к выбранному homeserver, а не заменять его частичной копией. PostgreSQL подходит для прикладных проекций, поиска и аудита, но не должен объявляться единственным источником истины для федеративной комнаты. Socket.IO разумно использовать для UI-уведомлений и внутренних прикладных проекций; Matrix `/sync` остаётся протоколом получения Matrix-событий.

## 2. Уведомления, in-app и mute

### Подтверждено

- Matrix разделяет push-уведомления и синхронизацию. Client-Server API имеет push rules, pushers и endpoint notifications; push rules могут включаться/выключаться и менять actions. В API также есть unread/read markers. [2]
- Push Gateway — отдельная сущность. Homeserver отправляет HTTP `/_matrix/push/v1/notify`, gateway передаёт уведомление провайдеру устройства, например APNS или GCM/FCM. Спецификация требует учитывать `event_id` для подавления дублей при повторах и допускает передачу счётчиков `unread` и `missed_calls`. [4]
- Push gateway не равен мобильному provider-у: это промежуточный Matrix HTTP API и сервис, который далее говорит с APNS/FCM. Следовательно, фоновые mobile push нельзя честно обещать только за счёт Kotlin/Compose, Next.js или Socket.IO. Нужны зарегистрированные push credentials, provider и gateway/worker-логика.
- In-app уведомление можно строить на постоянном `/sync`, WebSocket-потоке или локальной проекции событий. Это не гарантирует доставку в background/terminated state мобильной ОС. Официальный SDK умеет назначать push actions и выдавать события приложениям, но реальное фоновое пробуждение зависит от OS/provider. [3]
- Mute в Matrix можно выразить через push rules/actions, в том числе `dont_notify`, а также через локальные/аккаунтные настройки клиента. Это подавляет или меняет push-алерты, но не означает, что события перестанут приходить в sync или исчезнут из истории. [2]

### Рекомендация NOVA

Для NOVA хранить отдельно `notification_policy` комнаты/диалога, `push_registration` устройства, `unread_count`, `read_marker` и `in_app_visibility`. На Android зарегистрировать FCM, на iOS — APNs; не прятать их за обещанием «Socket.IO решит push». Redis использовать для fan-out, deduplication и короткоживущих presence/typing ключей, PostgreSQL — для durable device registrations и настроек. Фоновую доставку выполнять отдельным worker-ом с retry/backoff и дедупликацией по `event_id`/notification id.

## 3. Фото, видео, голосовые, файлы и истории

### Подтверждено

- Client-Server API содержит media repository endpoints для upload, download, thumbnail и config. Upload передаёт бинарное тело, после чего событие сообщения ссылается на media URI (`mxc://...`) и метаданные содержимого. [2]
- В официальном SDK перечислены media handling и authenticated media. Для новых серверов скачивание/thumbnail может требовать `Authorization`; в браузере это влияет на реализацию `<img>`/`<video>` и может потребовать fetch/service-worker подхода. SDK предупреждает, что в будущем authentication-required URLs станут обязательными. [3]
- Форматы сообщений позволяют различать текст, изображения, видео, аудио/voice message и файлы через тип сообщения и его content metadata. Это протокольные события, а не встроенное долговременное object storage в Next.js или Socket.IO. Сам media repository/homeserver должен хранить байты или подключать backend storage.
- История комнаты запрашивается через sync и pagination endpoints (`rooms/{roomId}/messages` и связанные relations). История может быть доступна только с учётом membership, ACL, retention, redaction и E2EE-ключей. [1] [2]
- «Stories» как функция публичных исчезающих публикаций не являются базовой стабильной Matrix-функцией на уровне общих room/message/media API. Matrix разрешает custom event types, но это не делает Element Stories автоматически совместимыми или операционно готовыми. [1]

### Что нельзя честно добавить без media storage и workers

Без S3/MinIO/объектного media storage или media repository нельзя честно заявлять надёжную отправку и повторное скачивание фото, видео, голосовых и файлов. Нужны также MIME/размерные лимиты, antivirus/content validation, thumbnails/transcoding, lifecycle/retention и signed/authenticated download strategy.

Без фоновых workers нельзя честно обещать надёжное transcoding видео, waveform/metadata для voice, thumbnail generation, cleanup orphaned media, retry загрузок и push fan-out. GitHub Actions может тестировать и собирать такие компоненты, но не является их runtime worker-ом.

Для NOVA начать с текстовых сообщений и ссылочных media records, затем добавить отдельный media service: presigned upload, checksum, размер/тип, thumbnail job и authenticated download. Stories либо не включать в MVP, либо определить собственную модель с TTL, privacy audience, media storage и worker cleanup; не выдавать её за стандартную Element/Matrix возможность.

## 4. Звонки и realtime

### Подтверждено

- Matrix Client-Server API включает VoIP TURN discovery endpoint `GET /_matrix/client/v3/voip/turnServer`; звонки используют Matrix-события/сигналинг и WebRTC-стек клиента. [2]
- Официальный `matrix-js-sdk` прямо перечисляет WebRTC calling среди возможностей SDK. Однако SDK не превращает произвольный backend в media relay и не гарантирует прохождение NAT/firewall. [3]
- Официальный Element Call описывает современный MatrixRTC-подход. Его README указывает LiveKit backend и SFU для масштабирования; клиент обнаруживает MatrixRTC transport, получает URL LiveKit и JWT от MatrixRTC Authorization Service, затем обменивается media через WebRTC. [5]
- Element Call содержит отдельные backend-компоненты для Synapse, MatrixRTC Authorization Service и LiveKit SFU даже в dev docker-compose. Это подтверждает, что group call — не только UI-компонент и не только Socket.IO-события. [5]
- Full-mesh может быть приемлем для малых звонков, но официальное описание Element Call отдельно указывает SFU/LiveKit для масштабируемых встреч. При выборе SFU меняются стоимость, deployment, egress, privacy model, observability и capacity planning. [5]

### Что нельзя честно добавить без TURN/SFU

Без TURN нельзя честно обещать стабильные 1:1 звонки за NAT и корпоративными firewall. Без SFU или равноценного media backend нельзя честно обещать групповые звонки, screen sharing на масштабе и предсказуемую полосу: Socket.IO передаёт signaling/control, но не заменяет WebRTC media transport. Для NOVA: 1:1 — WebRTC + TURN; группы — MatrixRTC/LiveKit или другой SFU, authorization service и health/metrics. Kotlin/Compose и Next.js отвечают за UI/client integration, не за media relay.

## 5. Приватность и безопасность

### Подтверждено

- Matrix поддерживает optional end-to-end encryption. Спецификация выделяет Olm и Megolm ratchets для E2EE; Olm предназначен для pairwise sessions, Megolm — для группового ratchet. [1] [6]
- В E2EE homeserver обычно хранит зашифрованный event payload и метаданные маршрутизации, но клиентские устройства должны иметь ключи для расшифровки. Официальный JS SDK реализует crypto через Rust `matrix-sdk-crypto` WebAssembly bindings; в браузере по умолчанию использует IndexedDB crypto store. SDK предупреждает, что несколько MatrixClient, одновременно работающих с одной IndexedDB, могут вызвать corruption/decryption failures. [3]
- Безопасность включает device identity, device verification, key backup/recovery и корректное multi-device состояние. Это не сводится к TLS: TLS защищает transport, E2EE защищает содержимое от homeserver/перехвата при корректной настройке ключей, но метаданные комнаты, участники, timestamps и routing остаются операционно значимыми.
- События считаются untrusted input. Клиент NOVA обязан ограничивать размеры, проверять типы, не интерпретировать произвольные custom event bodies как безопасные HTML/URL и защищаться от XSS, oversized payload и malicious media. [1]
- Element Web — официальный Matrix-клиент; репозиторий лицензирован AGPL-3.0 с альтернативными условиями лицензирования Element. Код и брендинг нельзя копировать в NOVA; допустимо изучать публичные API/архитектурные идеи с соблюдением лицензий. [7]

### Рекомендация NOVA

Для Kotlin/Compose предпочтителен зрелый Matrix client SDK/crypto stack с persistent encrypted local store, а не самописная криптография. Для Next.js не хранить access token в небезопасном client-side месте и не отдавать E2EE keys серверу без явного продуктового решения. NestJS должен валидировать JWT/session, rate-limit, membership/room authorization и media metadata, но не пытаться «расшифровывать всё на сервере» в E2EE-режиме.

В PostgreSQL хранить только нужные прикладные проекции и encrypted-at-rest secrets; секреты provider/TURN/LiveKit — в secret manager. Redis не использовать как единственное хранилище сообщений, receipts или ключей. GitHub Actions: lint, unit/integration, migration checks, dependency/SAST scanning, Android/Next/Nest builds; secrets и production deploy — через защищённые environments.

## 6. Конкретная рекомендуемая архитектура NOVA

1. **Android (Kotlin/Compose).** Matrix client layer с `/sync`, local echo, pagination, read receipts, media auth и E2EE persistence. UI state маппит Matrix event lifecycle в `queued/sending/accepted/synced/read/failed/redacted`. Для звонков — WebRTC client, TURN credentials и отдельный MatrixRTC/LiveKit integration.
2. **Web (Next.js).** Серверная аутентификация и route protection; клиентская timeline projection с cursor/back-pagination; authenticated media fetch вместо предположения, что `mxc://` можно вставить как публичный URL. Для E2EE нужен аккуратный browser crypto store и single-client-per-store lifecycle.
3. **Backend (NestJS).** BFF/adapter и domain APIs NOVA: profiles, conversation index, moderation policy, device/push registration, notification preferences, media orchestration и audit. Не подменять homeserver частичным REST CRUD, если нужна федерация, Matrix E2EE и совместимость с Element.
4. **Realtime (Matrix sync + Socket.IO).** Matrix `/sync` — authoritative stream для Matrix rooms. Socket.IO — прикладной low-latency канал для projection invalidation, typing/presence или dashboard, с reconnect, ack, idempotency и fallback; не использовать его как замену durable Matrix event log.
5. **PostgreSQL.** Durable users/devices/settings/projections/outbox/audit. Индексы по room/event/timestamp и retention policies. Не считать projection полностью актуальной без sync cursor/checkpoint и replay/reconciliation.
6. **Redis.** TTL для typing/presence, distributed locks, rate limits, queue broker и notification dedupe. Не хранить там единственную копию media, message history или E2EE keys.
7. **GitHub Actions.** CI для Kotlin/Compose, Next.js и NestJS; contract tests against a disposable homeserver; media/security tests; migration and rollback checks. Production push/thumbnail/transcoding/reconciliation workers должны жить в runtime orchestration, а не только в CI.

## 7. Матрица честных обещаний

- **Можно сделать без дополнительных media/call провайдеров:** текстовые события, sync timeline, локальный echo, read markers/receipts, edit/redaction UI, basic push-rule preferences, typing/presence, базовая in-app лента при работающем sync.
- **Нельзя честно обещать без media storage:** надёжные фото/видео/аудио/voice/file uploads, thumbnails, download after restart, retention и media scanning.
- **Нельзя честно обещать без push provider/gateway:** mobile push в фоне или после termination, badge/sound/actions на iOS/Android.
- **Нельзя честно обещать без TURN:** устойчивые peer-to-peer звонки в реальных сетях.
- **Нельзя честно обещать без SFU/LiveKit или иного media backend:** групповые звонки, масштабируемую конференцию, predictable bandwidth и server-side media routing.
- **Нельзя честно обещать без фоновых workers:** transcoding, thumbnails, waveform, push retry/dedup, cleanup, retention enforcement и eventual projection repair.
- **Stories:** не заявлять как «готовая Matrix/Element функция» без собственного event/media/TTL/privacy дизайна и тестов совместимости.

## References

[1]: https://spec.matrix.org/v1.19/ "Matrix Specification: Client-Server and architecture overview"
[2]: https://spec.matrix.org/v1.19/client-server-api/ "Matrix Client-Server API"
[3]: https://github.com/matrix-org/matrix-js-sdk "matrix-js-sdk official repository"
[4]: https://spec.matrix.org/v1.19/push-gateway-api/ "Matrix Push Gateway API"
[5]: https://github.com/element-hq/element-call "Element Call official repository"
[6]: https://spec.matrix.org/v1.19/olm-megolm/ "Matrix Olm and Megolm specification"
[7]: https://github.com/element-hq/element-web "Element Web official repository"
