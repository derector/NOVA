# Signal: исследование функций и архитектурных выводов для NOVA

Дата исследования: 2026-11-15  
Объект: только Signal; используются официальные страницы Signal Support, signal.org/docs и официальные репозитории signalapp.  
Статус фактов: **Подтверждено** — прямо указано в источнике; **Рекомендация** — вывод для NOVA; **Предположение/не переносить** — инженерная гипотеза, не обещание поведения Signal.

## Границы и важное предупреждение

Signal — ориентир по пользовательским сценариям и приватным протоколам, а не готовая библиотека для встраивания в NOVA. Официальный `libsignal` прямо говорит, что используется официальными клиентами и сервером, а использование вне Signal не поддерживается; API и реализации могут меняться без предупреждения [1]. Поэтому NOVA не следует копировать код, фирменный визуальный стиль, тексты или позиционирование Signal. Нужно реализовать собственный продуктовый и криптографический дизайн с отдельным threat model и аудитом.

## 1. Сообщения: отправка, доставка, прочтение, редактирование и удаление

**Подтверждено.** В Signal есть последовательные состояния: sending — сообщение отправляется; sent — передано сервису Signal; delivered — доставлено на устройство получателя; read — прочитано, если квитанции прочтения включены у обеих сторон [2]. Доставка зависит от того, что устройство получателя подключено и может забрать сообщения; официальные рекомендации отдельно упоминают интернет, уведомления, battery optimization и смену safety number [2]. Это означает, что в NOVA нужно различать серверное принятие, доставку на устройство и прочтение, а не сводить их к одному `status`.

**Подтверждено.** Квитанции прочтения — настраиваемая функция. Скрытая квитанция не должна интерпретироваться как «не прочитано»: это лишь отсутствие разрешённого сигнала [2]. Для приватности в NOVA хранить и показывать read receipt следует только при явном согласии участников и с понятной семантикой.

**Подтверждено.** Отправитель может редактировать своё сообщение до 10 раз в течение 24 часов. Сообщение получает отметку Edited, а история редактирования доступна пользователю; исключение — Note to Self может редактироваться без ограничения окна времени, но всё равно не более 10 правок [3]. Для NOVA рекомендованы immutable message id, `revision_no`, `edited_at` и отдельный audit/revision record. Не перезаписывать историю без следа.

**Подтверждено.** Delete for everyone — best effort: только сообщение, отправленное самим пользователем, и только в течение 24 часов; цитируемые ответы не удаляются [4]. Удаление сообщения/чата только на своём устройстве не удаляет его с телефона собеседника [5]. Для NOVA UI и API должны честно показывать разницу между `delete_for_me` и `delete_for_everyone`, а удаление для всех считать попыткой с возможной рассинхронизацией, а не гарантированным стиранием чужой копии.

**Подтверждено.** Исчезающие сообщения управляются участниками чата, применяются к новым сообщениям, синхронизируются с привязанными устройствами; отправитель начинает таймер после отправки, получатель — после прочтения, затем сообщение удаляется с диска [6]. Signal прямо предупреждает, что получатель может снять копию другой камерой [6]. В NOVA это следует описывать как локальную/протокольную очистку, не как защиту от копирования, скриншотов или внешней записи.

**Нельзя честно обещать без фоновых workers.** Надёжное истечение TTL, очистка объектов медиа, повторная доставка команд редактирования/удаления, дедупликация и reconciliation между офлайн-устройствами требуют очереди и фоновых workers. PostgreSQL cron или запрос при открытии чата — лишь неполная демонстрация.

## 2. Push, in-app уведомления и mute

**Подтверждено.** В Signal есть OS-level разрешения/уведомления и отдельные in-app/chat settings. Можно менять отображение уведомления: имя и сообщение, только имя либо без имени и сообщения; на Android и iOS доступны mute/hide для конкретного чата с периодами от часа до всегда, а также custom sounds [7]. Для muted chat Signal позволяет отдельно управлять badge count на iOS [7].

**Подтверждено.** Неполучение уведомления не равно неполучению сообщения. Signal указывает на интернет, WebSocket, OS permissions, battery optimization, Google Play services, место на устройстве, mute/block и уже просмотревший сообщение linked Desktop как реальные операционные причины [8]. В NOVA нужно отдельно моделировать `message accepted`, `push requested`, `push delivered/unknown`, `client sync` и `read`.

**Рекомендация для NOVA.** На Android использовать Kotlin/Compose для локального notification state, notification channels и deep link в conversation; на iOS-подобном клиенте/будущих платформах держать provider abstraction. Next.js должен отвечать за web/in-app notifications, а NestJS — за preference API и fan-out событий. Redis подходит для online presence, dedupe keys и Socket.IO adapter, но не является долговременным журналом доставки. GitHub Actions должен прогонять тесты идемпотентности push jobs, но сам не должен использоваться как runtime push worker.

**Нельзя честно добавить без push provider.** Настоящие background push при закрытом/уснувшем мобильном приложении невозможны без провайдера (например, системного push-провайдера) и токенов устройств. Без него можно сделать только in-app уведомления при открытом Socket.IO соединении и локальные уведомления при синхронизации.

**Нельзя честно добавить без фоновых workers.** Retry/backoff, collapse по conversation, quiet hours, удаление устаревших токенов и fan-out на много устройств требуют фоновой очереди/worker; один HTTP request NestJS не даёт гарантии доставки.

## 3. Фото, видео, голосовые, файлы и истории

**Подтверждено.** Официальные клиенты поддерживают сообщения и HD voice/video calls [9]. Signal отдельно предоставляет управление хранением Media, Files и Audio, сохранение вложений наружу и лимиты локальной истории; на Android доступны ограничения по времени и длине истории [5]. Официальный `libsignal` содержит media utilities, но это не означает, что он предоставляет NOVA готовое blob-хранилище или CDN [1].

**Подтверждено.** Stories — эфемерные фото, видео или текст, автоматически истекающие через 24 часа. Их можно направлять всем Signal connections, кастомному списку или группе; доступны скрытие от отдельных людей, replies/reactions и view receipts. Stories описаны как end-to-end encrypted и видимые только выбранным людям [10].

**Рекомендация для NOVA.** В PostgreSQL хранить metadata: attachment id, message/story id, mime, byte size, dimensions/duration, encrypted object key, checksum, lifecycle/expiry; сами байты держать в media storage с presigned upload/download URLs. NestJS должен авторизовать upload session и выдавать одноразовые grants, а не проксировать большие файлы через API. Next.js показывает прогресс и preview; Kotlin/Compose делает resumable upload/download, локальный encrypted cache и фоновые задачи платформы.

**Нельзя честно добавить без media storage.** Фото, видео, voice notes, документы, thumbnail/preview и 24-часовые stories нельзя реализовать как настоящую функцию только PostgreSQL/Socket.IO. Можно показать mock preview или маленький data URI, но это не production media pipeline. Нужны object storage, quotas, antivirus/content validation по policy, lifecycle cleanup и backup/restore plan.

**Предположение/не переносить.** Из официальных пользовательских страниц нельзя вывести конкретные универсальные лимиты размера файлов для NOVA. Не копировать Signal-лимиты вслепую: определить собственные лимиты, MIME allowlist, максимальный размер и правила хранения.

## 4. Звонки и realtime

**Подтверждено.** Групповой видеозвонок Signal требует актуальную версию клиента у каждого, членство в одной Signal Group и ограничен 75 участниками. Для групп до 16 участников можно отправить ringing notification; о звонке также появляется уведомление в истории группы [9]. Пользователю требуется разрешение камеры и микрофона [9].

**Подтверждено.** Официальная Android-документация описывает HD voice/video calls [9], а серверный репозиторий содержит server, websocket-resources и integration-tests; README указывает FoundationDB как зависимость Signal Server [11]. Это подтверждает, что realtime messaging — не только UI и не только Socket.IO.

**Рекомендация для NOVA.** Socket.IO использовать для сигналинга: call invitation, join/leave, offer/answer, ICE candidates, ringing state, participant state и reconnect. Не передавать через Socket.IO сам аудио/видеопоток. Для Kotlin/Compose отделить call state machine от UI; для web Next.js использовать WebRTC APIs, а NestJS — authorization/signaling gateway. Redis adapter нужен при нескольких NestJS instances, чтобы события комнаты не зависели от одного процесса.

**Нельзя честно добавить без TURN/SFU.** Двустороннее WebRTC может работать в простом сценарии через STUN/direct path, но production-звонки за NAT/firewall и групповые звонки нельзя честно обещать без TURN. Для группового media routing, масштабирования и устойчивости нужен SFU (или иной media server). Socket.IO сам по себе не является TURN, SFU или медиатранспортом.

**Нельзя честно добавить без workers/операционного слоя.** Call cleanup, abandoned sessions, recording of call metrics without content, TURN credential rotation, rate limits и reconciliation требуют фоновых задач и мониторинга. Не включать запись звонков по умолчанию: это отдельный правовой и privacy scope, которого официальные источники Signal для этого исследования не подтверждают.

## 5. Приватность и безопасность

**Подтверждено.** Signal публикует спецификации X3DH, PQXDH, Double Ratchet и Sesame. X3DH обеспечивает аутентификацию по публичным ключам, forward secrecy и cryptographic deniability; Double Ratchet выводит новые ключи для сообщений и смешивает DH public values; Sesame описывает управление сессиями в асинхронной multi-device среде [12]. На странице docs также перечислен ML-KEM Braid как sparse continuous key agreement с post-quantum forward secrecy и post-compromise security [12].

**Подтверждено.** `libsignal` содержит протокол Double Ratchet, криптографические примитивы, device transfer, zero-knowledge groups/credentials, usernames и media utilities; официальные приложения и сервер используют его, но внешний use unsupported и API subject to change [1]. Репозитории Signal Android, Desktop и Server лицензированы AGPL-3.0 [9] [11] [13]. Лицензия и исходный код не являются разрешением копировать брендинг или утверждать совместимость NOVA с Signal.

**Рекомендация для NOVA.** Для MVP сначала определить, нужна ли настоящая E2EE. Если нужна, не писать собственную криптографию в Kotlin/NestJS и не считать TLS заменой E2EE. Нужны отдельные identity/pre-key/device keys, session state, key rotation, multi-device semantics, safety verification, encrypted attachments и recovery model. На сервере PostgreSQL не хранить plaintext message bodies или media keys; логировать только минимально необходимые технические метаданные. Провести threat model и внешний криптографический аудит до заявления о приватности.

**Предположение/не переносить.** Нельзя утверждать, что NOVA будет иметь «уровень безопасности Signal», просто добавив `libsignal`, TLS и Socket.IO. Без корректной интеграции протокола, безопасного хранения ключей, проверки устройств, защиты push payloads и аудита это будет недоказанное маркетинговое заявление.

## 6. Ограничения и операционные зависимости

**Подтверждено.** Регистрация Signal использует существующий номер телефона, который должен принять SMS или verification call [14]. Для NOVA это не обязательный продуктовый выбор: можно использовать собственную account model, но нельзя предполагать, что номер телефона, push token или device identity бесплатны и бесконечно доступны.

**Подтверждено.** Signal Desktop связан с Android или iOS, а официальные репозитории разделяют client/server/libsignal responsibilities [13] [11] [1]. Это полезный ориентир для NOVA: мобильный клиент, web client, API/realtime и криптографический слой должны иметь чёткие границы.

**Рекомендованная целевая схема NOVA.** Kotlin/Compose: локальная БД, optimistic UI, outbox/inbox, receipt state machine, encrypted key storage, attachment transfer. Next.js: web UI, SSR только для безопасных оболочек, Socket.IO client и WebRTC UI. NestJS: REST/GraphQL для account/chat metadata, Socket.IO gateway для realtime, authorization и transactional outbox. PostgreSQL: users/devices/conversations/messages/revisions/receipts/attachments/stories/call sessions/preferences; индексы по conversation and event sequence, optimistic concurrency. Redis: Socket.IO adapter, presence, rate limiting, ephemeral locks, idempotency and job broker support. GitHub Actions: lint, unit/integration/contract tests, migration checks, Android/web/backend builds, security scanning, release artifacts; не использовать Actions как постоянный message/push worker.

## 7. Приоритизация для NOVA

1. **Реалистичный MVP без внешних медиа/звонков:** текст, серверные события, inbox/outbox, sent/delivered/read semantics, edit до 10 раз/24 часа как собственное правило, delete-for-me, базовый mute и in-app notifications. Честно обозначить, что background push, attachments и calls ещё не доступны.
2. **Следующий слой:** push provider, device token lifecycle, worker queue, retry/dedupe, notification privacy modes, media storage и encrypted upload/download. Только после этого добавлять фото, видео, voice notes и файлы.
3. **Realtime calls:** WebRTC signaling через Socket.IO, затем TURN, затем SFU для групп. Ограничение участников, permissions, ringing и reconnect сначала зафиксировать в собственном контракте NOVA.
4. **Privacy milestone:** threat model, key lifecycle, E2EE design, device verification, encrypted media and metadata minimization, external audit. До этого не обещать Signal-подобную приватность.

## References

[1]: https://github.com/signalapp/libsignal "libsignal official repository"
[2]: https://support.signal.org/hc/en-us/articles/360007320751-How-do-I-know-if-my-message-was-delivered-or-read "Signal message delivery and read status"
[3]: https://support.signal.org/hc/en-us/articles/6255134251546-Edit-Message "Signal Edit Message"
[4]: https://support.signal.org/hc/en-us/articles/360050426432-Delete-for-everyone "Signal Delete for everyone"
[5]: https://support.signal.org/hc/en-us/articles/360049673331-Storage-Management "Signal Storage Management"
[6]: https://support.signal.org/hc/en-us/articles/360007320771-Set-and-manage-disappearing-messages "Signal disappearing messages"
[7]: https://support.signal.org/hc/en-us/articles/360043273491-In-App-Notification-Options "Signal in-app notification options"
[8]: https://support.signal.org/hc/en-us/articles/360007318711-Troubleshooting-Notifications "Signal notification troubleshooting"
[9]: https://support.signal.org/hc/en-us/articles/360052977792-Group-Video-Calling "Signal group video calling"
[10]: https://support.signal.org/hc/en-us/articles/5008009166234-Stories "Signal Stories"
[11]: https://github.com/signalapp/Signal-Server "Signal Server official repository"
[12]: https://signal.org/docs/ "Signal technical specifications and software libraries"
[13]: https://github.com/signalapp/Signal-Android "Signal Android official repository"
[14]: https://support.signal.org/hc/en-us/articles/360007318691-Send-a-message "Signal registration requirements"
