# WhatsApp как референс для NOVA

Дата исследования: 2026-11-15  
Область: только WhatsApp и официальные источники WhatsApp/Meta, официальный репозиторий Signal Protocol/libsignal и стандарты, на которые прямо ссылается документация Meta.  
Статус фактов: **подтверждено** означает, что это следует из открытой официальной документации; **рекомендация/вывод** — проектное решение для NOVA, а не утверждение о внутренней реализации WhatsApp.

## 1. Границы сравнения

WhatsApp имеет два разных публичных технических контура. Потребительский WhatsApp Messenger — закрытое приложение с E2EE-сообщениями и звонками. WhatsApp Business Platform/Cloud API — интеграционный API для бизнес-номера, webhooks, медиа и Calling API. Публичный Cloud API не является API для полного клонирования потребительского клиента. Поэтому ниже не приписываются бизнес-ограничения каждому обычному личному чату.

## 2. Сообщения: отправка, доставка, прочтение, редактирование и удаление

**Подтверждено.** В Cloud API отправка выполняется через Messages API. Входящие сообщения приходят в `messages` webhooks, а сообщения, отправленные бизнесом пользователю, отслеживаются через `statuses` webhooks. Официальная документация показывает статусы `sent`, `delivered` и `read`; для одного исходящего сообщения может прийти до трёх отдельных status-webhook. Статусный webhook описывает статус, идентификатор сообщения и получателя, а не содержимое исходного сообщения [1] [2].

**Подтверждено для приложения WhatsApp.** Сообщение можно редактировать в течение 15 минут после отправки. Отредактированное сообщение помечается `edited`, изменение не отправляет новую chat-notification, а фото, видео и другие типы медиа редактировать нельзя [3].

**Подтверждено для приложения WhatsApp.** Отправленное сообщение можно удалить «для себя» или запросить удаление «для всех». Официальная справка указывает окно до двух дней для Delete for everyone; удалённое сообщение заменяется системной надписью. Получатель мог увидеть сообщение до удаления, удаление может не сработать без отдельного уведомления, а копия медиа могла сохраниться в Photos на iOS. Удаление «для себя» не меняет копию у получателей; предусмотрено короткое Undo-окно 5 секунд. В группах администратор может удалять сообщения других участников, с отдельной пометкой [4].

**Подтверждено.** Исчезающие сообщения можно включить для чата или задать по умолчанию для новых чатов; доступные таймеры — 24 часа, 7 дней и 90 дней. Таймер применяется только к новым сообщениям, а отдельное сообщение можно сохранить в чате [5].

**Ограничение доказательности.** Открытая документация не раскрывает всю внутреннюю модель очередей и подтверждений consumer-to-consumer. Для NOVA нельзя честно обещать «доставлено» или «прочитано» как криптографически доказанный факт: это клиентские сигналы, зависящие от онлайна, фонового режима, нескольких устройств и настроек приватности. Следует хранить отдельные server/client events (`sent_at`, `delivered_at`, `read_at`) и разрешать отсутствие read-receipt.

## 3. Push, in-app уведомления и mute

**Подтверждено.** WhatsApp позволяет отдельно настраивать уведомления сообщений, групп и звонков, звуки, рингтоны, previews, reaction notifications, background sync и desktop incoming/outgoing sounds. Системные настройки устройства имеют приоритет над настройками WhatsApp [6].

**Подтверждено.** Для отдельного или группового чата можно отключить уведомления на 8 часов, 1 неделю или всегда. Сообщения продолжают поступать, но устройство не вибрирует и не издаёт звук. Для звонков и сообщений действует настройка mute; при mute группового чата на телефоне он также muted в Web/Desktop, тогда как прочие notification settings между устройствами независимы [7].

**Рекомендация для NOVA.** Разделить три слоя: (1) in-app event через Socket.IO, (2) push wake-up для офлайна через системного push provider, (3) локальное решение клиента показывать звук, badge, preview или banner. Mute хранить как серверную политику на conversation/member (`muted_until`, `mute_calls`, `mute_mentions`), но не считать mute удалением сообщений. В Android-клиенте Kotlin/Compose использовать notification channels и уважать Do Not Disturb; на iOS/Web соответствующий push/browser механизм должен быть отдельным адаптером.

**Нельзя честно добавить без push provider и фоновых workers.** Надёжные уведомления при закрытом/замороженном приложении, доставку с retry и дедупликацией, badge-счётчики после reconnect и отложенные disappearing-message jobs. Socket.IO сам по себе не заменяет push: он работает только пока соединение живо.

## 4. Фото, видео, голосовые, файлы и истории/status

**Подтверждено.** Официальный Messages API перечисляет text, audio, document, image, video, sticker, location, reaction и другие типы. Audio загружается как ресурс, video показывается с thumbnail и caption, document — как скачиваемый файл, image поддерживает caption [2]. Потребительский WhatsApp также публично описывает Status и медиа-функции; сведения о конкретных сроках и аудитории Status следует реализовывать только после отдельной проверки соответствующей официальной справки, не выводить из UI-копирования [8].

**Подтверждено для Cloud API.** Для медиа предусмотрены upload, получение URL, download и delete. Media ID из API истекает через 30 дней, ID из входящего webhook — через 7 дней; URL для скачивания действителен 5 минут. Загруженные через API файлы шифруются и хранятся 30 дней, если не удалены раньше. В документации указаны лимиты: изображения JPEG/PNG до 5 MB, audio и video до 16 MB, документы до 100 MB, общий максимум скачивания media message — 100 MB. Для видео поддерживаются H.264 и AAC с оговорками по профилю/контейнеру [9].

**Рекомендация для NOVA.** Схема PostgreSQL должна отделять `messages` от `attachments`: MIME, размер, checksum, encryption metadata, storage key, thumbnail key, upload status и retention deadline. Next.js не должен проксировать большие файлы через web UI; NestJS выдаёт короткоживущие presigned URLs, а клиент делает resumable/direct upload. В Android используйте WorkManager для фоновой загрузки/повторной отправки, Compose — только отображение состояния. Redis нужен для краткоживущих upload/session locks и realtime presence, PostgreSQL — источник истины.

**Нельзя честно добавить без media storage.** Фото, видео, голосовые, документы, thumbnails, повторная загрузка и история Status невозможны надёжно только в PostgreSQL или памяти процесса. Нужны объектное хранилище, антивирус/валидация MIME, политика retention, фоновые transcoding/thumbnail workers и очистка просроченных объектов.

## 5. Звонки и realtime

**Подтверждено для обычного WhatsApp.** Официальная страница функций описывает voice/video calls, calls один-на-один и в группах, web/desktop/mobile, E2EE, отсутствие ограничения длительности в публичном описании и групповые звонки до 32 участников; также заявлены screen sharing и другие call features [8].

**Подтверждено для Business Calling API.** Cloud API Calling использует Graph API + webhooks для signaling и WebRTC для media; документация указывает ICE + DTLS + SRTP и OPUS. Для включения нужны Cloud API business number, subscription на `calls` webhook, permission `whatsapp_business_messaging`, требования к messaging limit и включение calling settings. В Calling FAQ указано, что Meta не предоставляет партнёру STUN/TURN или WebRTC infrastructure. Подтверждены также международные вызовы, возможность отправлять сообщения во время звонка и максимум 5000 concurrent calls на один Cloud API account phone number в текущем FAQ; страны и лимиты могут меняться [10] [11].

**Рекомендация для NOVA.** Socket.IO использовать для signaling приложения (call offer/answer, ICE candidates, ringing, accept/reject, reconnect), но не как media transport. WebRTC-клиенты Kotlin и web должны обмениваться SDP/ICE через NestJS; Redis adapter нужен для горизонтального fan-out signaling/presence. Для групповых звонков сразу закладывать SFU, а не mesh: SFU выдаёт предсказуемую нагрузку и позволяет масштабировать комнаты. Для NAT traversal нужен TURN; для медиа-терминации и записи — отдельная VoIP/SFU инфраструктура.

**Нельзя честно добавить без TURN/SFU.** Надёжные звонки между сетями, групповые calls, screen sharing на масштабе и восстановление media path нельзя обещать, имея только NestJS и Socket.IO. Без TURN часть пользователей за NAT/firewall не соединится; без SFU групповые звонки быстро упираются в uplink и CPU клиента. Нельзя заявлять E2EE звонков NOVA без отдельного threat model, key management, криптографического протокола и независимого аудита.

## 6. Приватность и безопасность

**Подтверждено.** WhatsApp заявляет E2EE для личных сообщений и calls: содержимое расшифровывается на устройствах, а ключи меняются с каждым сообщением. Пользователь может сверить security code для чата, включая QR и 60-значное число; WhatsApp описывает автоматическую key transparency. В сообщениях бизнесу режим и обработка отличаются: после получения бизнесом данные подчиняются его privacy practices, а некоторые optional services не считаются E2EE [12].

**Подтверждено.** WhatsApp Help Center говорит, что сообщения защищаются Signal encryption protocol. Официальный `signalapp/libsignal` содержит Signal Protocol и криптографические примитивы, но прямо предупреждает: репозиторий используется официальными клиентами Signal, использование вне Signal не поддерживается, API и реализации могут меняться без уведомления [13].

**Рекомендация для NOVA.** Не копировать брендинг или код WhatsApp/libsignal. Для MVP зафиксировать TLS 1.3 in transit, шифрование at rest, device/session revocation, минимизацию metadata, audit log без plaintext, rate limits, abuse reporting и безопасное хранение push tokens. Для настоящего E2EE применять проверенный протокол и библиотеку с поддерживаемой лицензией/командой, а не самописную криптографию; сервер должен видеть только минимум routing metadata. В требованиях явно разделить «TLS-защищённый чат» и «E2EE-чат» — это не одно и то же.

## 7. Конкретная архитектура NOVA на указанном стеке

- **Kotlin/Compose:** offline-first локальная БД и outbox; UI-состояния `sending/sent/delivered/read/failed`; WorkManager для upload/retry; Android notification channels, deep links, voice recorder и WebRTC native layer.
- **Next.js:** web-клиент и SSR/route shell, direct-to-object-storage upload, Socket.IO client, WebRTC UI; не держать долгие realtime-сессии в serverless request handlers.
- **NestJS:** auth/device sessions, conversation/message REST, idempotency keys, webhook-like event ingestion, Socket.IO gateway, authorization, signed URLs и moderation boundaries. Подтверждение delivery/read должно быть отдельным command/event, а не inferred из HTTP 200.
- **PostgreSQL:** users/devices, conversations/members, messages, message edits, tombstones/deletions, receipts, reactions, attachments, notification preferences, calls/call legs и retention policies. Нужны уникальные client message IDs и append-only event/audit trail.
- **Socket.IO:** ephemeral realtime transport, presence, typing, receipts, call signaling; Redis adapter/pub-sub для нескольких NestJS instances. Все события должны быть idempotent и восстанавливаться через cursor/sync из PostgreSQL после reconnect.
- **Redis:** presence TTL, Socket.IO adapter, distributed locks, rate limit counters, short-lived upload/call state. Не использовать Redis как единственное хранилище сообщений или media metadata.
- **GitHub Actions:** lint/typecheck, Kotlin unit/instrumentation tests, NestJS integration tests with PostgreSQL/Redis services, schema migration check, dependency/SCA scanning, secret scanning, container build and deploy gates. Для медиа и звонков нужны отдельные smoke tests с object storage и TURN/SFU test environment.

## 8. Что входит в реалистичный MVP, а что отложить

Реалистичный MVP без дорогой инфраструктуры: текстовые 1:1 и группы, outbox/retry, sent/delivered/read как best-effort, edit/delete с серверными окнами, mute, in-app realtime, базовые push notifications при подключённом provider, ссылки и реакции. Следующий слой: media storage, thumbnails, voice messages и Status с workers. Только после этого — WebRTC 1:1 через TURN. Групповые calls, запись, screen share, E2EE с multi-device и масштабный moderation pipeline требуют отдельной архитектуры и операционной зрелости.

## 9. Операционные зависимости и честные ограничения

NOVA не должна обещать полную функциональную эквивалентность WhatsApp на одном стеке приложения. Media storage обязателен для фото/видео/голосовых/файлов/Status. Push provider обязателен для уведомлений, когда приложение не держит активный сокет. Background workers обязательны для retries, TTL/disappearing messages, thumbnail/transcoding, cleanup и гарантированной доставки задач. TURN обязателен для надёжной WebRTC-связи в неблагоприятных сетях. SFU обязателен для масштабных групповых calls. Без этих зависимостей можно реализовать только ограниченный online-only prototype и это нужно прямо маркировать.

## References

[1]: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components "WhatsApp Cloud API messages webhook reference"
[2]: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages "WhatsApp Cloud API service messages"
[3]: https://faq.whatsapp.com/6614640168569481 "WhatsApp Help Center: How to edit messages"
[4]: https://faq.whatsapp.com/1370476507114859 "WhatsApp Help Center: How to delete messages"
[5]: https://faq.whatsapp.com/5590979194321336 "WhatsApp Help Center: How to turn disappearing messages on or off"
[6]: https://faq.whatsapp.com/797069521522888 "WhatsApp Help Center: How to manage your notifications"
[7]: https://faq.whatsapp.com/694350718331007 "WhatsApp Help Center: How to mute or unmute individual or group chat notifications"
[8]: https://www.whatsapp.com/features "WhatsApp official features"
[9]: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media "WhatsApp Cloud API media reference"
[10]: https://developers.facebook.com/documentation/business-messaging/whatsapp/calling "WhatsApp Cloud API Calling"
[11]: https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/faq "WhatsApp Calling API FAQ"
[12]: https://faq.whatsapp.com/820124435853543 "WhatsApp Help Center: About end-to-end encryption"
[13]: https://github.com/signalapp/libsignal "Signal libsignal official repository"
