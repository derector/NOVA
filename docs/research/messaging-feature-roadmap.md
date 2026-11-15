# NOVA: сравнительное исследование и roadmap функций мессенджера

## 1. Рамки и выводы исследования

Документ синтезирует переданные результаты по Telegram, WhatsApp, Signal, Discord, Matrix/Element и Slack. Это не утверждение о текущем состоянии NOVA и не объявление функций реализованными. Указанные продукты используют разные модели: cloud/server-client encryption, опциональное или обязательное E2EE, федерацию, собственные push-контуры и разные media/call backends. Поэтому их функции следует использовать как архитектурные ориентиры, а не как обещание паритета.

Общий вывод: существующие PostgreSQL + NestJS + Socket.IO достаточны для хорошего текстового MVP и части локально активных realtime-сценариев, но не заменяют object storage, push-провайдеры, фоновые очереди, TURN или SFU. Socket.IO должен быть транспортом событий, presence, typing и signaling; PostgreSQL — источником истины для долговечных сущностей; Redis — ускорителем/эфемерным состоянием, а не единственным хранилищем истории.

### Сравнительные паттерны

| Область | Наблюдаемые паттерны | Архитектурный вывод для NOVA |
|---|---|---|
| Сообщения | У Telegram есть history watermark; Matrix использует transaction ID и sync; Discord подчёркивает дубликаты/пропуски/переупорядочивание; Slack использует cursor/event model | Нужны immutable message IDs, client idempotency keys, sequence/cursor, versioning, gap recovery и серверная ACL-проверка |
| Receipts | Платформы разделяют sent/delivered/read; read часто является watermark или зависит от настроек пользователя | Не смешивать доставку, открытие диалога, read receipt и push notification; допускаются best-effort и отсутствие read receipt |
| Уведомления | In-app, unread/read state, mute и OS push — разные слои; закрытое приложение требует APNs/FCM/Web Push и workers | Хранить preferences и device registrations отдельно от receipts; Socket.IO не считать заменой push |
| Медиа | Multipart/resumable upload, metadata, signed/expiring URLs, thumbnails, scanning, retention | Нужны object storage/CDN, фоновые jobs и политика доступа; бинарные данные не должны быть основным содержимым PostgreSQL |
| Calls | Socket/HTTP/WebSocket используются для signaling, а media идёт через WebRTC/UDP; TURN нужен для NAT/firewall, SFU — для групп | Сначала call state/signaling, затем 1:1 WebRTC с TURN; group calls только после SFU/media backend |
| Stories | Это отдельный media + audience + expiry + view/reaction контур; в некоторых источниках лимиты различаются, а для части продуктов API не подтверждён | Не считать stories частью обычных сообщений; сначала определить собственную модель, privacy и retention |
| Криптография | TLS/WSS не равны E2EE; multi-device E2EE требует identity, verification, key lifecycle, backup/recovery | Не использовать термин E2EE без threat model, протокола, UX верификации и аудита |

## 2. Целевой порядок вертикальных срезов

Каждый срез ниже должен завершаться работающим сквозным пользовательским сценарием, миграциями, observability, негативными тестами и rollback-планом. Порядок выбран так, чтобы сначала стабилизировать durable text/event foundation, затем добавить receipts/notifications, после чего подключать тяжёлые media и realtime media planes.

---

## Вертикальный срез 1: reliable realtime text

### Цель и границы

Надёжная отправка и получение текстовых сообщений в 1:1 и небольших группах: optimistic/local pending state, повтор после reconnect, пагинация, редактирование, удаление, typing/presence и устранение пропусков/дубликатов. Это не означает offline E2EE, background push или federation.

### API и backend

- REST/NestJS для command/query границы: создание сообщения, history с cursor, edit, delete-for-me/delete-for-everyone при утверждённых правилах, mark/read watermark и resync.
- Socket.IO gateway для `message.accepted`, `message.published`, `message.updated`, `message.deleted`, typing, presence и room membership. События должны быть versioned и иметь conversation sequence.
- Client command содержит `client_message_id`/idempotency key; повторная отправка возвращает тот же результат, а не создаёт дубликат.
- Авторизация обязательна на REST-команде и на каждом socket room/event. Нельзя считать факт подключения к room доказательством права доступа.
- При reconnect клиент передаёт последний cursor; сервер возвращает gap/resync либо диапазон событий. Нельзя полагаться только на доставку Socket.IO.

### PostgreSQL

Минимальная durable-модель: `conversations`, `conversation_members`, `messages`, `message_revisions` или revision metadata, `message_tombstones`, `user_conversation_read_state`, `outbox_events`, `inbox/idempotency_records`. Нужны индексы по `(conversation_id, sequence)` и по времени/ID для cursor pagination. Изменения делаются транзакционно вместе с outbox-записью. Redis может хранить presence/typing TTL, locks и adapter state, но не единственную историю.

### WebSocket/клиенты

Socket.IO используется для realtime projection, не как источник истины. Серверные события должны быть idempotent на клиенте. Клиенты сохраняют последний применённый sequence/cursor и умеют перейти в `reconciling` при gap, reorder или duplicate.

### Android и Web

- Kotlin/Compose: локальный repository/cache, outbox для pending messages, StateFlow reducer для состояний `pending → accepted → published → failed`, retry с backoff и reconnect/resync.
- Next.js: один управляемый Socket.IO lifecycle на session/store, optimistic UI, cursor pagination, обработка visibility/focus без ложного read state.
- Оба клиента должны показывать недоставленное/неподтверждённое состояние, а не выдавать optimistic отправку за серверно принятую.

### Infrastructure dependencies

На текущем стеке достаточно PostgreSQL, NestJS, Socket.IO и, при нескольких инстансах, Redis adapter. Для outbox-публикации на раннем этапе допустим отдельный runtime worker/процесс или контролируемый polling, но не GitHub Actions как runtime. Нужны logs/metrics по latency, reconnect, duplicate commands, gap recovery и failed outbox.

### Privacy и QA gates

- TLS/WSS, secure session/device revocation, ACL на conversation, rate limits, payload size/schema validation и content-minimizing logs.
- Не называть cloud/server-client encryption E2EE. E2EE отложено до отдельного threat model и key lifecycle.
- QA: повтор команды, duplicate/out-of-order events, reconnect во время отправки, crash после DB commit до emit, pagination boundary, concurrent edit/delete, unauthorized room access, rate limit и migration rollback.

### Definition of done

Один и тот же `client_message_id` не создаёт две записи; после reconnect клиент может восстановить последовательность; история доступна через cursor; редактирование/удаление идемпотентны; outbox repair наблюдаем; ни один UI-state не выдаёт локальную optimistic запись за подтверждённую доставку.

---

## Вертикальный срез 2: delivery/read receipts и notification preferences

### Цель и границы

Разделить состояния `accepted/sent`, `delivered` (клиент получил/подтвердил), `read` (клиент сообщил watermark) и notification delivery. Read receipts должны быть управляемой пользовательской политикой и не должны зависеть от наличия push.

### API и backend

- Команды `acknowledge_delivery` и `mark_read_through(conversation_id, message_sequence)` с monotonic semantics.
- Receipt API возвращает watermark, а не обязательную строку записей на каждое сообщение, где это подходит. Для групп заранее определить семантику: per-user watermark, агрегаты или ограниченный список.
- Notification preferences: global defaults, per-conversation override, `muted_until`, mention/direct-message policy, preview policy, sound/badge policy; системные OS permissions имеют приоритет.
- События receipts публикуются отдельно от message events. Push job не должен менять read state.
- Дедупликация push jobs по user/device/conversation/message/event и retry/backoff должны быть частью worker-контракта.

### PostgreSQL

`message_delivery_receipts` (если нужны per-message записи), `user_conversation_read_state`, `notification_preferences`, `devices`, `device_push_tokens`, `notification_jobs/outbox`, optional `unread_counters`. Read watermark должен быть монотонным и защищён optimistic concurrency. Токены устройств шифровать/ограничивать доступом и поддерживать rotation/revocation.

### WebSocket/клиенты

Foreground Socket.IO events подходят для активной сессии. Они не гарантируют уведомление закрытого приложения. Клиент посылает delivery ack после фактического получения/обработки, а read watermark — после открытия/прочтения согласно UX-политике. Offline, OS battery optimization, mute и отсутствие permission могут привести к отсутствию push/read.

### Android и Web

- Android: local unread/read state, notification channels, runtime permission handling, WorkManager/worker integration для push-related retry после появления инфраструктуры; не предполагать, что socket жив в фоне.
- Web: in-app unread/activity model; Web Push и service worker — отдельный этап; не путать browser visibility с гарантированным прочтением.

### Infrastructure dependencies

In-app receipts и mute могут работать на текущем стеке. Настоящие background notifications потребуют FCM/APNs/Web Push provider, device registration, gateway/provider abstraction, retry worker, dedupe и observability. Redis полезен для TTL/dedupe/locks, PostgreSQL — для durable preferences и registrations.

### Privacy и QA gates

- Явные настройки read receipts; не утекать содержимое в push preview без согласия.
- Минимизировать push payload; подписанные/ограниченные device credentials, revoke on logout, ACL и retention для receipt data.
- QA: mute expiration/time zones, per-chat override precedence, duplicate/out-of-order acks, read watermark regression, offline-to-online replay, revoked token, provider failure, quiet hours/OS permission, foreground vs terminated app.

### Definition of done

Пользователь может отдельно управлять mute/preview/read receipt; UI корректно отображает отсутствие receipt; reconnect не откатывает watermark; in-app event не заявляется как background push; provider contract и worker остаются behind feature flag до появления внешнего push-контура.

---

## Вертикальный срез 3: media/file pipeline

### Цель и границы

Надёжные вложения для photo/video/audio/voice/document: resumable upload, metadata, validation, download, preview/thumbnail, retention и удаление. Истории и звонки не считаются автоматически готовыми после этого среза.

### API и backend

- NestJS endpoints: `create_upload`, part/session status, complete/abort, attachment metadata, authorized download URL, thumbnail/status и delete/retention.
- Direct-to-object-storage upload через signed/presigned URLs; не проксировать большие бинарные данные через Next.js/NestJS handlers.
- Checksum/MIME/size validation на сервере; доверие к расширению файла запрещено. Attachment state machine: `created → uploading → uploaded → scanning/processing → ready/rejected/expired`.
- Async workers для multipart completion, malware scanning, thumbnails/transcoding, waveform/metadata, retry и lifecycle cleanup.
- Ссылки должны быть scoped/expiring; не считать CDN/object URL постоянным публичным адресом.

### PostgreSQL

`attachments`, `upload_sessions`, `attachment_parts`, `message_attachments`, processing status, checksum, MIME/size, object key, thumbnail variants, retention/expiry, scan result и audit metadata. Бинарный blob не хранить как основной durable store в PostgreSQL.

### WebSocket/клиенты

Socket.IO сообщает progress/state changes, но прогресс должен восстанавливаться запросом к upload session. HTTP/object-storage transfer остаётся отдельным от message event. Message command ссылается только на готовое/разрешённое attachment ID.

### Android и Web

- Android: WorkManager для resumable transfer, local attachment queue, pause/resume, checksum and retry; UI должен различать локальный draft, upload и опубликованное сообщение.
- Next.js: direct upload, progress, authenticated download/fetch и безопасные preview; не помещать privileged storage keys в bundle.

### Infrastructure dependencies

Обязательны S3-совместимое object storage, signed URLs, CDN/authorized media access, background queue/worker, scanning и lifecycle policy. Для production transcoding потребуются CPU/storage budget и observability. Без них допустим только текстовый placeholder/локальный draft, но не production media promise.

### Privacy и QA gates

- Least-privilege object access, no public permanent URLs, retention/deletion semantics, EXIF/metadata policy, malware/content scanning and audit.
- Для E2EE media нужен отдельный encrypted upload/key design; TLS upload не равен E2EE media.
- QA: interrupted/resumed multipart upload, checksum mismatch, duplicate completion, expired URL, unauthorized download, oversized/forged MIME, scan rejection, thumbnail failure, cleanup retry, deleted message with retained local copy.

### Definition of done

Вложение восстанавливается после process/network failure, доступно только авторизованным пользователям, имеет наблюдаемый processing state и lifecycle. До появления storage/workers нельзя утверждать надёжные photo/video/voice/file features.

---

## Вертикальный срез 4: stories

### Цель и границы

Отдельный ephemeral-модуль для media/text stories с аудиторией, исключениями, сроком истечения и view/reaction/reply semantics. Исследование подтверждает разные реализации у продуктов, но не даёт единого универсального лимита для NOVA; все лимиты должны быть продуктово определены, а не скопированы по умолчанию.

### API и backend

- REST: create draft/publish, list active stories by audience, view, react/reply, hide/mute, delete, report.
- Socket.IO: story published/expired/view-count invalidation для активных клиентов; durable truth остаётся PostgreSQL.
- Audience snapshot или carefully versioned rule evaluation; decide whether later block/hide changes access to already-published stories.
- Expiry worker marks/archives stories and triggers media lifecycle cleanup. TTL без worker/DB enforcement не является надёжным удалением.

### PostgreSQL

`stories`, `story_audiences`/visibility rules, exclusions, `story_media`, `story_views`, `story_reactions/replies`, expiry index, moderation/report state и audit. Нужны rate/size limits и индексы по active/expiry.

### WebSocket/клиенты

Realtime invalidation only; list endpoint must reconcile after reconnect. View receipt should be idempotent and privacy-controlled. Never broadcast story metadata to unauthorized rooms.

### Android и Web

Story viewer/uploader, audience picker, hidden users, expiry UI, failed upload state and local cache eviction. Android background upload depends on media worker; Web needs authenticated media fetch and no permanent URL assumption.

### Infrastructure dependencies

Stories depend on the full media pipeline, object storage, signed access, workers, lifecycle cleanup and likely moderation/scanning. They are not a cheap extension of text messages.

### Privacy и QA gates

- Explicit audience preview, block/hide semantics, view privacy, screenshots policy only if actually designed and testable; do not promise screenshot detection.
- Enforce expiry server-side, but document that already downloaded/cached copies cannot be universally recalled.
- QA: timezone/clock skew, expiry races, audience changes, blocked user, duplicate views, unauthorized direct media access, cleanup failure, report/moderation path and offline viewer cache.

### Definition of done

Audience and expiry semantics are documented and enforced end-to-end; storage cleanup is observable; no story is exposed via a generic conversation ACL mistake; unsupported product-specific limits are not presented as NOVA guarantees.

---

## Вертикальный срез 5: voice/video calls

### Цель и границы

Сначала signalling/state machine и 1:1 calls, затем reliable WebRTC with TURN. Group calls, screen sharing, recording and large-audience modes are separate milestones requiring SFU/media backend.

### API и backend

- Call records/session state: `ringing`, `accepted`, `connecting`, `connected`, `ended`, `failed`, timeout/cleanup, participant/device IDs and reason codes.
- REST for call history/config/token retrieval; Socket.IO only for offer/answer, ICE candidates, ringing, accept/reject, mute/camera state and reconnect signalling.
- Credential rotation, authorization, participant ACL and abandoned-session cleanup. Redis can hold short-lived call state, but PostgreSQL stores call record/audit according to policy.
- Do not send audio/video over Socket.IO.

### PostgreSQL

`call_sessions`, `call_participants`, device/capability metadata, start/end timestamps, failure reason, consent/recording policy if ever introduced. Avoid storing sensitive media or SDP longer than necessary.

### WebSocket/clients

WebRTC media plane with ICE. Socket.IO is control/signalling only. Reconciliation handles mobile sleep, network change, duplicate candidates and peer timeout. TURN is needed for reliable NAT/firewall traversal; SFU is needed for scalable group media and predictable bandwidth.

### Android и Web

- Android: native WebRTC layer, microphone/camera permissions, audio focus, Bluetooth/headset routing, network handover and foreground call UX.
- Web: browser WebRTC permissions, device selection, visibility/network recovery and secure session handling.
- Both: explicit call states; no UI claim of connected media before ICE/DTLS/media health is confirmed.

### Infrastructure dependencies

1:1 production reliability requires STUN/TURN, credential service, metrics and call cleanup workers. Group calls/video/screen share require SFU/media server (for example a selected, independently evaluated backend), authorization and capacity/health management. Incoming calls while app is stopped additionally require push provider.

### Privacy и QA gates

- TLS/WSS for signalling; define whether media is peer-to-peer, relay or SFU and what E2EE claim is supportable.
- Never claim Telegram/WhatsApp/Signal-like E2EE without a verified protocol, key lifecycle and audit. Call metadata retention must be minimized.
- QA: symmetric/blocked NAT, firewall, TURN fallback, Wi-Fi↔cellular handover, device permission denial, Bluetooth route, background/terminated app, timeout cleanup, duplicate signalling, reconnect and SFU load/failure tests.

### Definition of done

Before TURN, NOVA may ship only a clearly labelled experimental/local-network or signalling slice, not “reliable calls”. Before SFU, group calls and screen sharing remain deferred. Before push provider, background incoming-call alerts remain unavailable.

---

## 3. Быстрые улучшения на PostgreSQL + NestJS + Socket.IO без S3/FCM/TURN

Следующие изменения реалистичны без перечисленных внешних зависимостей, при условии аккуратной реализации и тестирования:

1. Надёжный текстовый outbox/inbox: idempotency keys, transactional outbox, ordered per-conversation sequence, cursor pagination и reconnect gap recovery.
2. Optimistic UI с явными состояниями pending/accepted/failed и повтором после reconnect; дедупликация duplicate/out-of-order socket events.
3. Edit message и delete-for-me; delete-for-everyone только после определения собственных ACL/окон/политики и с tombstone, а не физическим исчезновением из event stream.
4. Per-user read watermark и best-effort delivery ack в активной сессии; отдельно хранить receipt policy и не выдавать его за push.
5. In-app mute, per-chat notification preferences, preview policy, mention/direct-message rules, unread cursors и badge counters для активного клиента.
6. Typing indicators, presence TTL и reconnect-aware room membership; Redis можно добавить как adapter/ephemeral state, если появится несколько NestJS инстансов.
7. Rate limits, payload/schema validation, ACL regression tests, session/device revocation, audit-minimized logs и базовая observability.
8. Contract/integration tests в CI: migrations, duplicate commands, out-of-order events, reconnect, concurrent edit/delete, unauthorized room access и rate-limit behavior.
9. Текстовые drafts и attachment placeholders/metadata-only UI, не обещая загрузку или durable media.
10. Signalling state machine как технический прототип без обещания reliable voice/video: call invite/accept/reject/timeout can be exercised with fake media, but production calls remain gated on TURN/SFU.

Даже для этих быстрых улучшений нельзя утверждать background mobile push, durable media, stories, reliable NAT-traversing calls или E2EE.

## 4. Функции, которые следует отложить

- Production photo/video/audio/voice/document uploads, thumbnails, transcoding, malware scanning и retention до S3-compatible storage, signed URLs и workers.
- Background notifications и incoming-call alerts до FCM/APNs/Web Push, device-token lifecycle, provider gateway и retry/dedupe workers.
- Reliable 1:1 voice/video до TURN/STUN, WebRTC integration, credential service, network/permission QA и observability.
- Group calls, screen sharing, recording, livestream/large-audience modes до SFU/media backend, capacity planning и отдельной privacy/consent policy.
- Stories до media pipeline, audience/privacy model, expiry worker, cleanup и moderation/reporting.
- Multi-device E2EE, secret chats, key verification, forward secrecy, key backup/recovery и encrypted media до threat model, supported protocol, UX и independent security review.
- Disappearing messages, legal hold/export and advanced retention until deletion semantics, local copies, audit and compliance requirements are defined.
- Universal parity with Telegram/WhatsApp/Signal/Discord/Slack; source results establish patterns and constraints, not a feature-completion claim.

## 5. Сквозные release gates и измерения

Перед каждым срезом нужны миграционный план и rollback, API/event schema versioning, feature flags, load/rate-limit envelope, structured metrics and privacy review. Минимальные SLO/SLI candidates: message accept latency, publish-to-client latency, reconnect recovery time, gap repair rate, duplicate command rate, outbox age, receipt lag, notification provider success (when present), upload resume success (when present), call setup/ICE/TURN success (when present), and cleanup backlog.

Security gates: dependency/SAST/secret/container scanning, authorization tests, secure token storage, WSS/TLS, signed URL expiry, payload limits, SSRF/XSS-safe metadata handling, data retention and minimized logs. Product copy must distinguish “sent/accepted”, “delivered”, “read”, “notification attempted” and “media ready”; no status should imply a stronger guarantee than the backend can prove.

## 6. Итоговая рекомендация

Рекомендуемый MVP NOVA: reliable realtime text, cursor history, edit/delete policy, best-effort active-session delivery/read semantics, in-app mute/preferences, typing/presence, device/session revocation and reconnect recovery. Следующий инвестиционный этап — push and media foundation. Затем — TURN-backed 1:1 WebRTC. Stories и group calls should follow only when their dependencies, privacy semantics and operational gates are funded and testable.
