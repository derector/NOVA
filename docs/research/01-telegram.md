# Исследование Telegram для проектирования NOVA

**Дата исследования:** 2026-11-15  
**Область:** только Telegram; использованы официальная документация Telegram/Core API, официальный репозиторий TDLib и официальные страницы Telegram FAQ. Код и фирменный стиль Telegram не копируются.  
**Статус утверждений:** формулировки с пометкой **Подтверждено** прямо следуют из источников; **Рекомендация NOVA** — проектный вывод для NOVA, а не утверждение о внутренней реализации Telegram.

## 1. Ключевая модель Telegram

**Подтверждено.** Telegram разделяет облачные чаты и Secret Chats. Для облачных чатов MTProto описывает шифрование «клиент—сервер»; для Secret Chats ключ хранится только на устройствах участников и используется отдельная end-to-end схема [1] [2]. Secret Chat является one-to-one и device-specific, поэтому сообщения не синхронизируются через Telegram cloud на другие устройства [1].

**Подтверждено.** Активный клиент получает события через механизм updates, а не обязан периодически опрашивать сервер. Updates имеют последовательности `seq`, `pts`/`pts_count` и `qts`; при разрыве последовательности клиент должен восстановить gap отдельным запросом. События создания, редактирования и удаления сообщения входят в эти последовательности [3].

**Рекомендация NOVA.** Разделить доменные состояния сообщения и транспортные события: `messages`/`message_revisions`/`message_receipts` в PostgreSQL, а `message.created`, `message.edited`, `message.deleted`, `typing`, `presence` и `call.signal` передавать через Socket.IO. Для каждого диалога хранить монотонный `event_seq` и cursor клиента; при gap клиент должен запрашивать reconciliation, а не надеяться на повторную доставку Socket.IO.

## 2. Отправка, доставка, прочтение, редактирование и удаление

**Подтверждено.** В FAQ Telegram один check означает, что сообщение доставлено в Telegram cloud и собеседник получил уведомление, если разрешил уведомления. Два check означают, что собеседник открыл Telegram и открыл разговор с сообщением. Отдельного статуса «доставлено на конкретное устройство» нет, потому что аккаунт может работать на нескольких устройствах [1]. В one-to-one и малых группах доступно точное время прочтения; для приватности оно хранится семь дней, а скрытие last seen скрывает и read time [1].

**Рекомендация NOVA.** Не моделировать Telegram-подобный read receipt как один boolean. Нужны минимум `sent_at`/серверный `accepted_at`, `delivered_at` как подтверждение приёма сервером, и per-user `read_up_to_message_id`/`read_at`. В UI показывать «отправлено», «принято сервером», «прочитано»; не обещать «доставлено на устройство», если нет device-level ack.

**Подтверждено.** API `messages.readHistory` помечает историю до переданного `max_id` прочитанной и возвращает affected update state [4]. Это подтверждает cursor-подход: чтение можно фиксировать как watermark, а не создавать запись на каждое сообщение.

**Подтверждено.** `messages.editMessage` редактирует текст, entities, reply markup и media; официальная FAQ также описывает редактирование собственного сообщения, включая добавление или замену фото, видео или файла, и отображение edited label/времени последнего изменения [1] [5]. Ограничения зависят от типа чата, прав и временного окна; официальный метод возвращает, среди прочего, `MESSAGE_EDIT_TIME_EXPIRED`, `MESSAGE_AUTHOR_REQUIRED` и ошибки прав [5].

**Подтверждено.** `messages.deleteMessages` принимает `revoke`, который означает удаление для всех участников; FAQ уточняет, что в личном диалоге пользователь может удалить отправленные и полученные сообщения для обеих сторон, а в группах — свои сообщения, с дополнительными правилами прав [1] [6]. Удалённое сообщение в Telegram-чате не оставляет видимой отметки [1].

**Рекомендация NOVA.** Делать edit/delete идемпотентными командами с `client_command_id`, optimistic UI и серверной проверкой автора/прав/TTL. Хранить audit/retention отдельно от пользовательского представления: «удалено для всех» должно удалять содержимое и выдавать delete event, а не просто скрывать его только в одном клиенте. Политику редактирования (например, окно 15 минут) задавать конфигурацией NOVA и явно показывать пользователю; не выдавать её за ограничение Telegram.

## 3. Push, in-app уведомления и mute

**Подтверждено.** TDLib Notification API группирует уведомления по типам Messages, Mentions, SecretChat и Calls. TDLib отвечает за создание, изменение, удаление и сохранение активных уведомлений согласованно с состоянием базы, но конкретный способ отображения предоставляет клиентской платформе [7]. Есть лимиты числа групп и уведомлений в группе; по умолчанию Notification API фактически выключен при `notification_group_count_max = 0`, а значения ограничены диапазоном до 25 [7].

**Подтверждено.** Для push TDLib использует регистрацию устройства, связывает push receiver ID с аккаунтом и обрабатывает push через `processPushNotification`. Push может быть без содержимого, после чего клиент должен подключиться к Telegram за данными; поддерживаются FCM и APNs, включая опционально end-to-end encrypted push payloads [7]. TDLib также различает delayed/pending notifications при недоступной сети [7].

**Подтверждено.** В Telegram один check может означать, что уведомление было разрешено пользователем; это не эквивалент прочтению [1]. FAQ и API показывают, что mute/notification privacy — пользовательская настройка, а прочтение наступает отдельно при открытии диалога [1] [7].

**Рекомендация NOVA.** В PostgreSQL хранить `notification_preferences` на уровне пользователя, диалога и scope: `muted_until`, `mentions_only`, `preview`, `sound`, `badge`. При входящем событии сначала применять mute и policy, затем создавать job для push; in-app Socket.IO-событие может приходить независимо от push. Для дедупликации push использовать `(user_id, conversation_id, event_id)` и badge cursor. На Android/iOS планировать отдельные каналы/категории уведомлений, а Next.js web — Web Push Service Worker; сервер не должен считать push доказательством доставки или прочтения.

**Нельзя честно добавить без push provider.** Надёжные фоновые push-уведомления, badge в закрытом приложении и звонок поверх закрытого телефона невозможны только средствами Kotlin/Compose, Next.js и NestJS. Потребуются APNs/FCM или web push provider, device-token lifecycle и фоновые workers для retries/expiry. Без этого можно сделать только in-app уведомления при активном Socket.IO соединении.

## 4. Фото, видео, голосовые, файлы и истории

**Подтверждено.** Официальный Files API описывает загрузку файла по client `file_id`, разбиение на части и параллельные очереди; размер части должен удовлетворять условиям протокола, максимальная часть — 512 KB. Для файлов свыше 10 MB используется `upload.saveBigFilePart`, для меньших — `upload.saveFilePart`; временные загруженные части могут жить от нескольких минут до нескольких часов [8]. API имеет отдельные input media для photo и document, включая video, thumbnails, MIME и TTL [8].

**Подтверждено.** TDLib возвращает прогресс и завершение скачивания через `updateFile`; скачивание асинхронно, имеет priority, offset/limit и synchronous/asynchronous режим [9]. Это подтверждает необходимость resumable transfer и progress state в клиенте, а не одной долгой HTTP-команды.

**Подтверждено.** Telegram FAQ описывает фото, видео, voice/video messages, view-once media, self-destruct timer для media и auto-delete для сообщений. Для view-once Telegram пытается уведомить о screenshot, но прямо предупреждает, что обнаружение не является bulletproof на всех системах [1].

**Подтверждено.** Stories API позволяет публиковать vertical photo/video с caption, privacy rules и сроком действия; в актуальном API для обычного пользователя срок — 24 часа, Premium может использовать дополнительные периоды. Для story заявлен лимит media до 30 MB, действуют weekly/monthly/active-story limits и права канала/группы [10]. Stories имеют отдельные read/view операции и пагинацию по state [10].

**Рекомендация NOVA.** Для медиа использовать pipeline: pre-signed upload или multipart upload → virus/content validation → metadata row → object storage → thumbnail/transcode worker → message attachment. В `attachments` хранить MIME, size, checksum, width/height/duration, storage key, variants и upload status; в сообщении хранить ссылку на attachment, а не blob. В Android использовать WorkManager для resumable upload/download, в web — resumable fetch и background retry. Voice message — это файл плюс duration/waveform/codec metadata, а не отдельная магическая сущность.

**Нельзя честно добавить без media storage.** Фото, видео, voice, документы, thumbnails, view-once media и stories нельзя надёжно реализовать только PostgreSQL/Socket.IO. Нужны object storage/CDN, quotas, signed URLs, обработка EXIF/metadata, transcoding/thumbnails и lifecycle deletion. Без storage допустим только текст и временная передача маленьких payloads, но это не Telegram-подобная медиафункция.

**Нельзя честно добавить без фоновых workers.** Транскодирование видео/voice, thumbnail generation, virus scan, auto-delete/self-destruct timers, story expiry, push retries и очистку orphaned uploads требуют очереди и workers. Redis может быть broker/short-lived state, но сам по себе не заменяет worker execution или durable job state.

## 5. Звонки и realtime

**Подтверждено.** Telegram поддерживает end-to-end encrypted one-to-one calls. Call flow включает request/accept/confirm, серверные privacy checks и updates для всех активных устройств вызываемого пользователя. После подтверждения клиенты передают media handoff в tgcalls; API содержит WebRTC connection options, включая TURN/STUN, и signaling data [11].

**Подтверждено.** Group calls разделяются на video chats/livestreams, live stories и conferences. Video chats/livestreams используют WebRTC или RTMP; при большой аудитории сервер может переключить слушателей в stream mode, где они скачивают media chunks вместо live WebRTC. Group calls поддерживают mute, участников, invite links, server-side recording и in-call messages/reactions в соответствующих режимах [12].

**Рекомендация NOVA.** Socket.IO использовать для signaling/presence/call state, но не для аудио/видео media plane. Для MVP: one-to-one WebRTC, NestJS signaling gateway, short-lived call session в Redis, durable call record в PostgreSQL. Вызов должен иметь state machine `ringing → accepted → connecting → connected → ended/failed`, timeout и idempotent transitions. Устройства должны подписывать signaling messages и проверять call/session nonce.

**Нельзя честно добавить без TURN/SFU.** Работающий WebRTC между произвольными мобильными сетями требует STUN/TURN и relay fallback; групповой звонок с несколькими publishers требует SFU/media server. Socket.IO не является media relay, а NestJS не заменяет TURN/SFU. Без них можно показать демонстрационный local/P2P сценарий, но нельзя обещать Telegram-подобную устойчивость, privacy или масштабирование.

**Операционная зависимость.** Для production calls нужны TLS, TURN credentials rotation, ICE diagnostics, bitrate/codec policy, reconnect, background call permissions, Android foreground service, iOS CallKit/PushKit и мониторинг. Эти детали не следует скрывать за UI-кнопкой «Позвонить».

## 6. Приватность и безопасность

**Подтверждено.** MTProto описывает отдельные high-level API, cryptographic authorization и transport компоненты. Cloud chats используют server-client encryption; транспорт может быть TCP, HTTP(S), WebSocket/WSS и другими transport modes. Telegram подчёркивает необходимость соблюдения Security Guidelines для клиентов [2] [13].

**Подтверждено.** Secret Chats используют Diffie–Hellman, ключ доступен участникам, поддерживают self-destruct и perfect forward secrecy re-keying; Secret Chat device-specific и не является cloud chat [1] [2]. Telegram отдельно предупреждает, что screenshot detection не может быть гарантировано на каждом устройстве [1].

**Рекомендация NOVA.** Не маркировать обычное серверно-расшифровываемое сообщение как E2EE. Выбрать и документировать две модели: обычные cloud conversations с server-side encryption at rest/in transit и отдельный opt-in E2EE режим с устройственными ключами, key verification, rotation, lost-device recovery policy и ограничениями multi-device. Для MVP безопаснее реализовать честный cloud mode и не использовать слово «end-to-end».

**Рекомендация NOVA.** Включить TLS/WSS, short-lived access/refresh tokens, device/session list, revocation, rate limits, abuse controls, encrypted secrets, least-privilege media URLs, server-side authorization на каждое действие и structured audit logs. Не логировать содержимое сообщений, push payloads и media URLs в обычные application logs. WebSocket authentication должна проверяться при handshake и периодически при rotation, а не приниматься на доверии от клиента.

## 7. Ограничения и операционные зависимости

**Подтверждено.** Telegram передаёт часть ограничений динамически через config: размер чата, лимиты сообщения/caption, upload part limits, data centers, online/VoIP timeouts и другие значения; клиент должен обновлять config после `updateConfig` [14]. Поэтому копирование одного жёсткого числа из документации в продуктовую модель ненадёжно.

**Подтверждено.** TDLib — официальный cross-platform client library; он берёт на себя network details, encryption, local storage, ordered updates, устойчивость к слабой сети и encrypted local data при user-provided key. TDLib имеет Java/JNI и JSON интерфейсы, но сам является C++17 зависимостью и лицензирован под Boost Software License [15].

**Рекомендация NOVA по стеку.**

- **Kotlin/Compose:** Android-first UI с локальным repository/cache, StateFlow, WorkManager для медиа и фоновых задач, уведомлениями через FCM/APNs bridge. Не внедрять TDLib только ради брендинга или копирования Telegram-протокола; для собственного NOVA-протокола использовать обычный HTTPS + WebSocket.
- **Next.js:** SSR/route shell и chat UI; клиентский Socket.IO lifecycle должен корректно восстанавливаться после tab sleep. Service Worker — только для Web Push и cache policy, не для обхода серверной авторизации.
- **NestJS:** REST/HTTP для команд и query, Socket.IO gateway для ordered domain events, typing/presence/signaling. Для каждого command handler применять authorization, idempotency key и transaction/outbox.
- **PostgreSQL:** source of truth для users/devices/conversations/messages/revisions/read watermarks/notification preferences/call records/media metadata. Индексы по `(conversation_id, created_at, id)` и cursor pagination; soft-delete только там, где это согласуется с retention policy.
- **Socket.IO:** transport и fan-out, не durable queue и не media plane. Redis adapter нужен для нескольких NestJS instances; Redis также использовать для presence, rate limits, ephemeral typing и call sessions с TTL.
- **Redis:** не хранить единственную копию сообщений, receipts или job state. Для надёжной доставки применить PostgreSQL outbox/inbox и consumer idempotency; Redis Streams/BullMQ допустимы для ephemeral/queued work, но jobs должны иметь retry, DLQ и observability.
- **GitHub Actions:** запускать unit/integration/e2e tests, migration checks, Android lint/test, Next/Nest build, dependency/SAST/secret scans, контейнерные image scans и deploy gates. Отдельно тестировать reconnect/gap recovery, duplicate commands, multi-device read state, upload resume, push token rotation и call timeout.

## 8. Что входит в честный MVP NOVA

**Можно реализовать без внешних media/call сервисов:** текстовые сообщения, server accepted state, per-user read watermark, edit/delete с правами, typing/presence через Socket.IO, per-chat mute в активном приложении, pagination, reconnect и gap recovery, device/session revocation.

**Нельзя честно заявлять без дополнительных компонентов:** background push при закрытом приложении без APNs/FCM/web-push provider; фото/видео/voice/files/stories без object storage и media workers; надежные voice/video calls без TURN; групповые calls без SFU/media server; auto-delete, transcode, thumbnails, virus scanning и push retry без фоновых workers; E2EE multi-device без продуманной key management и recovery архитектуры.

## References

[1]: https://telegram.org/faq "Telegram FAQ"
[2]: https://core.telegram.org/api/end-to-end "End-to-End Encryption, Secret Chats"
[3]: https://core.telegram.org/api/updates "Working with Updates"
[4]: https://core.telegram.org/method/messages.readHistory "messages.readHistory"
[5]: https://core.telegram.org/method/messages.editMessage "messages.editMessage"
[6]: https://core.telegram.org/method/messages.deleteMessages "messages.deleteMessages"
[7]: https://core.telegram.org/tdlib/notification-api/ "TDLib Notification API"
[8]: https://core.telegram.org/api/files "Uploading and Downloading Files"
[9]: https://core.telegram.org/tdlib/docs/classtd_1_1td__api_1_1download_file.html "TDLib downloadFile"
[10]: https://core.telegram.org/api/stories "Telegram Stories"
[11]: https://core.telegram.org/api/calls "Phone calls"
[12]: https://core.telegram.org/api/group-calls "Group calls"
[13]: https://core.telegram.org/mtproto "MTProto Mobile Protocol"
[14]: https://core.telegram.org/api/config "MTProto and client configuration"
[15]: https://github.com/tdlib/td "Official TDLib repository"
