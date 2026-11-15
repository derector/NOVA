# Исследование Discord для проектирования NOVA

**Дата:** 2026-11-15  
**Объект:** только Discord и его официальная документация/официальный репозиторий.  
**Назначение:** извлечь проверяемые продуктовые и технические паттерны, не копируя код или брендинг Discord.

## Как читать выводы

Формулировки **Подтверждено** означают, что поведение прямо описано в официальной документации Discord или Help Center. **Рекомендация NOVA** — проектный вывод для указанного стека, а не утверждение о внутренней реализации Discord. Если публичная документация не подтверждает функцию, это отмечено явно.

## Отправка, доставка, прочтение, редактирование и удаление

**Подтверждено.** Discord представляет сообщение отдельным объектом с идентификатором, каналом, автором, временем создания, временем редактирования, контентом, вложениями, реакциями, reply/reference и флагами. Сообщение создаётся через HTTP `POST` в канал; успешная операция возвращает объект сообщения и порождает Gateway-событие `MESSAGE_CREATE`. Для пользовательского текста документированы лимиты: до 2000 символов, до 10 rich embeds, а максимальный размер запроса создания сообщения — 25 MiB. Для прав доступа в guild-канале нужны `SEND_MESSAGES`, а для reply — также `READ_MESSAGE_HISTORY` [1].

**Подтверждено.** Редактирование порождает `MESSAGE_UPDATE`; удаление — `MESSAGE_DELETE`, а массовое удаление — `MESSAGE_DELETE_BULK`. Удаление-событие содержит ID сообщения и канала, но не полный старый текст. Следовательно, клиент должен уметь удалять локальную запись по ID и не рассчитывать на получение тела удалённого сообщения из realtime-события [2].

**Подтверждено.** Discord прямо предупреждает о eventual consistency: события могут не прийти, прийти один раз или несколько раз, а пользовательские операции могут выполняться не в том порядке или не выполниться. Клиенты должны быть идемпотентными [3]. Gateway — постоянный WebSocket; нужны heartbeat, ACK, sequence number, обработка disconnect/resume и intents. Отсутствие heartbeat ACK означает, что соединение следует закрыть и переподключить [4].

**Подтверждено.** В публичной Gateway-документации Discord перечислены create/update/delete-события сообщений, но отдельный универсальный API «прочитано получателем» для обычного сообщения не описан как независимое message-delivery/read-receipt событие. Help Center подтверждает пользовательские unread-состояния: Inbox показывает непрочитанные сообщения и mentions, сообщения можно помечать прочитанными по одному или все сразу [5]. Это не следует трактовать как гарантию серверного read receipt для каждого сообщения.

**Рекомендация NOVA.** Разделить состояния:

1. `accepted` — API проверил права и записал сообщение в PostgreSQL;
2. `published` — сервер разослал событие в Socket.IO;
3. `delivered` — конкретный клиент подтвердил получение/синхронизацию;
4. `read` — клиент записал cursor/последний прочитанный message ID для пользователя и канала.

Использовать client-generated idempotency key/nonce, уникальный `(sender_id, client_message_id)`, серверные ULID/UUID или bigint ID с курсором, версии записи и soft-delete/audit metadata. Историю загружать REST через Next.js/NestJS, realtime — через Socket.IO; при reconnect делать resync по cursor, а не полагаться только на события.

## Уведомления, unread и mute

**Подтверждено.** Discord имеет серверные и канальные настройки уведомлений. Для сервера доступны mute с длительностью, suppression для `@everyone`/`@here`, role mentions, новых событий и mobile push. Channel overrides позволяют выбрать `All`, `Mentions`, `Nothing` или `Mute`; полный mute канала/сервера скрывает unread-индикаторы и уведомления согласно настройке. Help Center отдельно указывает, что server mute отключает mobile push, но упоминания могут иметь отдельные правила [6] [7].

**Подтверждено.** На мобильном Discord отправляет push для событий, которые обычно уведомляли бы на desktop, при включённых настройках и наличии Android/iOS-интеграции [6]. Discord также имеет in-app Inbox для unread и mentions; это отдельный клиентский центр, в котором можно пометить сообщения прочитанными и менять mute [5].

**Рекомендация NOVA.** Модель `notification_preferences` должна быть иерархической: global → workspace/server → category → channel → thread, с приоритетами для direct mention/reply/call invite. Хранить `mute_until`, режим (`all|mentions|nothing|muted`), `suppress_everyone`, `suppress_roles`, `mobile_push_enabled`. Unread хранить как per-user/channel cursor, а не вычислять полным сканированием сообщений.

Для Android в Kotlin/Compose нужен push provider (например, FCM) и токен device-installation; для web — browser Push/Web Notifications при отдельном разрешении. NestJS должен сначала проверить mute/mention policy, затем создать notification job. Socket.IO обеспечивает foreground in-app событие, но сам по себе не доставляет push, когда приложение остановлено. В Redis удобно держать presence, ephemeral notification dedupe и Socket.IO adapter; окончательная история и настройки — в PostgreSQL.

## Фото, видео, голосовые, файлы и истории

**Подтверждено.** Discord принимает файлы через `multipart/form-data`; attachment metadata хранится в сообщении. В документации указано, что стандартный лимит — 20 MiB на файл, но он может быть выше в зависимости от Nitro/уровня сервера. Attachment CDN URL подписан и имеет срок действия; клиент должен корректно обновлять/перезапрашивать URL, а не считать его вечной публичной ссылкой. При редактировании сообщения сохраняются только attachment IDs, перечисленные в новом `attachments` payload; отсутствующие удаляются [8].

**Подтверждено.** Модель сообщения поддерживает attachments и флаг голосового сообщения (`IS_VOICE_MESSAGE`), а публичная документация описывает multipart-загрузки и CDN attachments [1] [8]. Это подтверждает наличие текстовых вложений, изображений, видео/аудио-файлов и voice-message-паттерна на уровне платформы, но не означает, что любой формат, лимит или transcoding автоматически доступен в публичном API.

**Не подтверждено публичными источниками в рамках этого исследования.** Универсальная Discord API-функция Stories/историй как обязательная часть доступной третьесторонней платформы не найдена в официальном API docs/repository. Поэтому NOVA не должна обещать Discord-подобные stories на основании одной только модели messages. Если stories нужны, это отдельный продуктовый модуль: media objects, expiry, viewer privacy, moderation, CDN и background cleanup.

**Рекомендация NOVA.** Не прокладывать бинарные данные через Next.js/NestJS в базу. Нужны media storage (S3-compatible object storage), presigned upload/download URLs, antivirus/content-type validation, size/quota checks, thumbnails/transcoding и lifecycle cleanup. PostgreSQL хранит metadata (`media_asset`, MIME, size, checksum, dimensions, duration, storage key, visibility, status), сообщения — ссылки/IDs. Фото и видео требуют thumbnail/preview pipeline; голосовые — waveform/duration, codec validation и playback URL. Удаление сообщения должно отдельно определять soft-delete metadata и удаление/retention объекта.

Без media storage честно нельзя добавить устойчивые фото, видео, голосовые, файлы или stories; без фоновых workers нельзя надёжно обещать transcoding, thumbnail generation, virus scanning, expiry cleanup и повторную обработку неудачных загрузок.

## Звонки и realtime

**Подтверждено.** Discord Gateway — WebSocket realtime для событий, но voice connection — отдельный voice WebSocket плюс UDP-путь для голосовых данных. Официальное руководство требует, чтобы клиент мог принимать UDP через firewall/NAT; описаны voice state update, session ID, voice server update, heartbeat, UDP IP discovery и шифрование voice packets [9]. Это существенно сложнее, чем передать аудио через обычный Socket.IO event.

**Подтверждено.** Discord описывает voice/video communications как защищённые; Privacy Policy говорит о TLS для текста/изображений в transit, шифровании данных at rest и том, что voice/video designed to be end-to-end encrypted, с отдельной документацией по E2EE A/V [10]. Это описание Discord нельзя автоматически переносить на NOVA: сервер NOVA должен отдельно определить threat model, key management, metadata exposure и E2EE-протокол.

**Рекомендация NOVA.** Socket.IO использовать для signaling и состояния звонка: call invite, ringing, accept/reject, participant join/leave, mute/camera state, ICE candidates, reconnect. Media plane строить на WebRTC. Для 1:1 можно начать с direct peer connection, но production NAT traversal требует STUN и TURN. Для групповых звонков/видео/демонстрации экрана нужен SFU; NestJS не должен пересылать каждый RTP-пакет. Нужны call session records, participant permissions, reconnect/ice restart и observability.

Без TURN нельзя честно обещать устойчивые звонки через корпоративные сети, symmetric NAT и restrictive firewalls. Без SFU нельзя честно обещать масштабируемые групповые аудио/видеозвонки, screen share и selective forwarding. Без push provider нельзя обещать входящий звонок при остановленном мобильном приложении; без фоновых workers нельзя надёжно вести call timeout, missed-call notification, recording/transcoding или cleanup. Recording не следует добавлять без отдельного consent, storage, retention и privacy design.

## Приватность, безопасность и операционные зависимости

**Подтверждено.** Discord заявляет, что информация шифруется in transit и at rest, текст и изображения идут через TLS, доступ сотрудников ограничивается техническими и административными controls. Privacy Policy также отмечает, что содержимое видео/голосовых звонков обычно не хранится, но продуктовые условия могут меняться; персональные данные хранятся до тех пор, пока нужны для целей обработки или legal compliance [10]. Контент в больших/public spaces может быть доступен многим людям и использоваться для safety/moderation и улучшения сервиса согласно настройкам/политике [10].

**Подтверждено.** OAuth2-документация Discord рекомендует `state` для связывания authorization request с пользовательской сессией и защиты от CSRF/clickjacking-сценариев; токены и secrets нельзя помещать в мобильный клиент или браузерный bundle [11]. Gateway MESSAGE_CONTENT — privileged intent; для некоторых приложений требуется включение/одобрение, а без него content/embeds/attachments/components могут быть пустыми, кроме оговорённых исключений [12].

**Подтверждено.** Discord API имеет route/global rate limits, возвращает `Retry-After` и rate-limit headers; лимиты нельзя hard-code. Для bots документирован global limit 50 requests/sec, а invalid requests могут привести к временной блокировке IP [13]. Gateway также имеет отдельные ограничения событий и Identify-concurrency [12]. Discord docs repository прямо предупреждает, что public API docs отражают third-party capabilities и исключают непубличные/неподдержанные функции [14].

**Рекомендация NOVA.** Для NOVA нужны TLS everywhere, refresh-token rotation, secure httpOnly cookies для web, Android Keystore для mobile secrets, authorization checks на каждую conversation/message/media action, rate limits per user/IP/route, abuse reporting, moderation hooks, audit log и data export/delete flow. WebSocket auth должна быть короткоживущей и проверяться при reconnect; события Socket.IO должны фильтроваться по membership/ACL, а не только по room name.

PostgreSQL — source of truth для users, conversations, membership, messages, read cursors, notification preferences, media metadata и audit records. Redis — adapter/pub-sub для нескольких NestJS instances, presence/typing TTL, distributed locks, dedupe и rate limiting; Redis не должен быть единственным хранилищем сообщений. GitHub Actions — CI для Kotlin/Compose и Next.js/NestJS, unit/integration/e2e tests, migration checks, dependency/security scanning, container build и deploy; secrets — GitHub environment secrets/OIDC, не repository files.

## Ограничения и план поставки NOVA

**MVP без внешней media/RTC-инфраструктуры:** текстовые сообщения, edit/delete, optimistic UI с idempotency, history pagination, Socket.IO realtime, reconnect/resync, read cursor, unread counters, in-app notifications, базовые mute/channel overrides и audit trail.

**Нельзя честно обещать без media storage:** durable photo/video/voice/file attachments, previews/thumbnails, stories, quota and retention. Можно показать локальный mock/ephemeral preview, но нельзя называть это production-функцией.

**Нельзя честно обещать без push provider:** background mobile push, reliable mention alerts при закрытом приложении и incoming-call push. Foreground Socket.IO notification — это не замена APNs/FCM/Web Push.

**Нельзя честно обещать без TURN/SFU:** надёжные NAT-traversed 1:1 calls, production group calls, scalable video, screen sharing и server-managed media routing. Socket.IO signaling alone не является voice/video transport.

**Нельзя честно обещать без фоновых workers:** transcoding, thumbnails, virus scanning, scheduled story expiry, notification retries/digests, missed-call jobs, orphan-media cleanup и robust delivery retry. Для этого подойдут NestJS workers с Redis-backed queue и идемпотентными jobs.

## Источники

[1]: https://discord.com/developers/docs/resources/message "Discord Message Resource"
[2]: https://discord.com/developers/docs/events/gateway-events "Discord Gateway Events"
[3]: https://discord.com/developers/docs/reference "Discord Developer Reference: Consistency and HTTP API"
[4]: https://discord.com/developers/docs/topics/gateway "Discord Gateway"
[5]: https://support.discord.com/hc/en-us/articles/360045027712-Inbox-FAQ "Discord Inbox FAQ"
[6]: https://support.discord.com/hc/en-us/articles/215253258-Notifications-Settings-101 "Discord Notifications Settings 101"
[7]: https://support.discord.com/hc/en-us/articles/209791877-How-do-I-mute-and-disable-notifications-for-specific-channels "Discord mute and channel notification settings"
[8]: https://discord.com/developers/docs/reference "Discord Developer Reference: Uploading Files and Attachment CDN URLs"
[9]: https://discord.com/developers/docs/topics/voice-connections "Discord Voice Connections"
[10]: https://discord.com/privacy "Discord Privacy Policy"
[11]: https://discord.com/developers/docs/topics/oauth2 "Discord OAuth2"
[12]: https://discord.com/developers/docs/topics/gateway#privileged-intents "Discord Gateway Privileged Intents"
[13]: https://discord.com/developers/docs/topics/rate-limits "Discord Rate Limits"
[14]: https://github.com/discord/discord-api-docs "Official Discord API Docs Repository"
