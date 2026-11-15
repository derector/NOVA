# NOVA — предварительный архитектурный план

**Статус:** проектный черновик, составлен только по предоставленным результатам исследования. Это не подтверждение реализации, развёртывания, сборки или доступности перечисленных сервисов. Технологические версии и контракты нужно зафиксировать в репозитории и проверить на чистой сборке до начала продуктовой реализации.

## 1. Архитектурное решение и конфликт с Manus Mobile starter

Целевой клиент первого этапа — **отдельное нативное Android-приложение на Kotlin и Jetpack Compose, minSdk 26 (Android 8)**. Expo/React Native и WebView исключаются: готовый Manus Mobile starter на Expo не соответствует строгому требованию нативного Kotlin/Compose и не должен становиться основой Android-клиента. Наличие стартера не снимает конфликт и не подтверждает возможность получить из него требуемое нативное приложение. Если используется Manus-инструментарий для проекта, Android-часть всё равно должна быть реализована отдельным Kotlin-приложением; способ интеграции с таким инструментарием в предоставленных исследованиях не подтверждён.

Система разделяется на Android-клиент, backend NOVA и отдельный браузерный клиент. **Backend и PostgreSQL — источник истины** для учётных записей, OTP-челленджей и сообщений. Android хранит локальную копию и очередь отправки для офлайн/ненадёжной сети. WebSocket/Socket.IO даёт live-обновления, но не заменяет сохранение и последующую синхронизацию через REST.

## 2. Целевая архитектура и потоки запросов

### 2.1 Основной сквозной поток: email OTP и текстовое сообщение

1. Android или web отправляет backend запрос на выдачу email OTP. Backend создаёт ограниченный по времени challenge, применяет лимиты, передаёт письмо через внешний SMTP/email-провайдер и не пишет код в логи. Клиент не отправляет email напрямую и не содержит credentials провайдера.
2. Пользователь передаёт код клиенту; клиент отправляет его на endpoint проверки. Backend проверяет срок действия, лимит попыток и одноразовость, затем выдаёт управляемую сессию/токен. Email OTP подтверждает контроль почтового ящика, но не считается надёжной MFA.
3. После авторизации Android читает данные через REST и записывает сообщения в Room. При создании исходящего сообщения одна транзакция Room добавляет сообщение с устойчивым client-generated UUID и запись outbox; UI сразу показывает локальное состояние `PENDING`.
4. При доступной сети foreground-клиент может отправить событие через WebSocket/Socket.IO. Надёжный fallback — уникальная одноразовая задача WorkManager с ограничением по сети и backoff, которая синхронизирует outbox через REST. Система не обещает мгновенную отправку при фоне/ограничениях ОС.
5. Backend проверяет доступ к диалогу, идемпотентно сохраняет сообщение в PostgreSQL и возвращает ack с серверным идентификатором/временем. Клиент обновляет Room и статус сообщения. Повторный запрос с тем же idempotency key не должен создавать дубликат.
6. Получатель получает live-событие по WebSocket. После переподключения клиент выполняет REST catch-up по cursor/sequence и сверяет события с локальной БД. Сокет не является долговечной очередью: событие, пропущенное в офлайне, должно быть восстановлено через REST.

### 2.2 Будущие потоки, не входящие в ядро MVP

- **Push:** backend отправляет через FCM непрозрачный сигнал о наличии изменений; приложение после этого синхронизируется с backend. FCM не является источником истины или транспортом гарантированной доставки сообщений.
- **Медиа:** backend проверяет право пользователя, выдаёт краткоживущий presigned PUT/GET URL к выбранному S3-compatible хранилищу; клиент передаёт файл напрямую. Backend хранит связь object key с владельцем/сообщением. Постоянные storage credentials остаются только на сервере.
- **Звонки:** клиент получает ограниченный room-grants токен от backend и подключается к SFU; отдельно нужны signaling, STUN/TURN и проверка сетевой доступности. Исследование рассматривает LiveKit как общий вариант Android/web/backend, но выбор и доступность аккаунта/инфраструктуры не подтверждены.

## 3. Слои Android

1. **UI — Jetpack Compose:** экраны OTP, списка/просмотра диалога и ввода сообщения; отображение локальных статусов отправки, ошибки и повторной попытки. Нативный Kotlin UI, без WebView.
2. **Presentation:** состояние экранов и обработка пользовательских действий; подписка на локальные данные, без сетевых операций на UI thread.
3. **Domain/use cases:** сценарии запроса/проверки OTP, чтения/отправки/синхронизации сообщений. Бизнес-правила протокола должны совпадать с backend-контрактами.
4. **Data:** репозитории, Room DAO, OkHttp для REST и официальный Java Socket.IO client для совместимого realtime-протокола, сериализация и сопоставление серверных ack/cursor с локальными строками. Room — источник состояния для UI и локальная копия, не механизм межустройственной синхронизации.
5. **Outbox и фоновые повторы:** транзакционный outbox в Room; WorkManager выполняет уникальные сетевые sync-задачи с network constraint и backoff. Он не заменяет активный WebSocket и не гарантирует немедленное выполнение.
6. **Безопасность/платформенная интеграция:** TLS и WSS; INTERNET и ACCESS_NETWORK_STATE; хранение выбранного чувствительного credential cache только при необходимости с ключом из Android Keystore. Keystore защищает ключевой материал, но не хранит произвольные данные, не шифрует Room автоматически и не гарантирует hardware-backed/StrongBox на каждом устройстве. Не помещать долгосрочные серверные ключи в APK.

Рекомендуемые кандидаты: Kotlin/AndroidX Compose, Room 2.8.x с KSP, WorkManager 2.12.x, OkHttp 5.x для REST и `io.socket:socket.io-client` 2.x для событий Socket.IO. Upstream Java-клиент совместим с Socket.IO сервером 3.x/4.x и распространяется под MIT. Обычный WebSocket-клиент нельзя считать протокольно совместимым с Socket.IO Gateway. Точные версии нужно закрепить и проверить в чистой сборке вместе с JDK, Gradle и Android Gradle Plugin.

## 4. Backend и браузерный клиент

### Backend

- **NestJS / TypeScript** как единый модульный сервис первого этапа: OTP, сессии, пользователи, сообщения, синхронизация и Socket.IO Gateway. Горизонтальное масштабирование и Redis adapter не требуются для минимального сценария; при нескольких backend-инстансах отдельно решать Redis adapter и sticky sessions/транспорт.
- **PostgreSQL + официальный `pg` driver** — постоянное хранилище и параметризованный SQL; versioned SQL migrations находятся в `backend/migrations/`. В текущем срезе Prisma не используется.
- **OTP:** криптографически стойкая генерация, хранение хеша кода, короткий TTL, одноразовое использование, инвалидирование после успеха, лимиты запросов и попыток, нейтральные ответы и исключение кодов из логов. SMTP через Nodemailer — только транспорт; нужен реальный внешний email-провайдер, подтверждённый отправитель и серверные credentials.
- **Авторизация:** REST и WebSocket используют серверно проверяемый контекст; каждый доступ к диалогу/событию авторизуется на backend. Серверные секреты, DATABASE_URL и ключи сессий — только в переменных окружения/secret manager.

### Web

Отдельный **Next.js App Router + React + TypeScript** клиент. Для интерактивной переписки и browser WebSocket применяются Client Components; серверные компоненты не должны раскрывать секреты. Для базового сценария достаточно fetch и browser WebSocket. Наличие web-клиента не доказывает работу Android offline/outbox и не снимает требование нативного приложения.

## 5. Данные и контракты

Контракты следует определить до параллельной реализации клиентов и закрепить как межъязыковую правду:

- **OpenAPI 3.1.x** — REST endpoints и DTO для запроса/проверки OTP, получения сообщений/catch-up, отправки сообщения и подтверждения. Генерация TypeScript типов через openapi-typescript допустима, но это статическая типизация, а не runtime-валидация.
- **Фактический REST контракт:** `shared/openapi.yaml`. События Socket.IO и reconnect/catch-up описаны в `shared/events.md`; отдельный AsyncAPI документ пока не создавался. Клиенты используют Socket.IO-compatible protocol, а не предполагают подключение сырого browser WebSocket к gateway.
- **Минимальные данные сообщения:** устойчивый client-generated UUID/idempotency key, диалог/участник с серверной авторизацией, текст, серверные идентификатор и временная метка, статус доставки/подтверждения. Формат окончательно закрепить в OpenAPI/AsyncAPI; не вводить в клиенты несогласованные варианты.
- **Синхронизация:** серверный cursor/sequence, запрос catch-up, дедупликация по client UUID и уникальные ограничения/транзакции в backend. Явно определить порядок ack и переход локальных статусов, а также ошибки конфликтов.
- **Реализованные сущности:** users, OTP challenges, refresh sessions, rate-limit buckets, direct chats/memberships и durable messages; Android Room хранит chats/messages/outbox/cursors. PostgreSQL DDL/migrations — `backend/migrations/001_initial.sql`.
- **Будущие сущности:** FCM installation/device token; медиа-объект и связь с сообщением; звонок/комната и права доступа. Добавлять при включении соответствующих этапов.

На backend HTTP DTO валидируются через class-validator/class-transformer; web DTO поддерживаются отдельными TypeScript типами. Zod и generated OpenAPI client в текущем коде не используются. Приватные сообщения не следует помещать в общее кэширование.

## 6. CI и выпуск APK

Локально создан `.github/workflows/ci.yml`. Он закрепляет upstream GitHub Actions по commit SHA; проверяет backend (typecheck, unit tests, build, audit, PostgreSQL migration и DB health smoke), web (lint, typecheck, production build, audit) и Android (`assembleDebug`, JVM unit tests, debug APK artifact). Сам workflow не был запущен на GitHub: remote repo не создан из-за отсутствующего scope создания репозитория у активного token.

Release job запускается по `v*` tag и использует защищённый GitHub Environment `release`. Он требует публичный HTTPS API URL и release signing secrets; временный keystore удаляется runner-ом. Gradle не выдаёт release APK без действительного ключа и HTTPS URL. Локально test-only ключом успешно проверена сборка и верификация подписанного release APK; тестовый ключ и APK затем удалены. Production signing key ещё не предоставлен.

JVM unit tests и debug APK build не доказывают runtime на Android API 26, работу SMTP, двух пользователей или офлайн-синхронизацию. Нужны Android устройство/эмулятор, реальная база, mail provider и внешний доступ к API.

## 7. Минимальный реальный MVP и этапы

### Этап 0 — основание (реализовано; удалённые интеграции не готовы)

Подтверждён native-only Android-клиент; выбраны Kotlin/Compose/JDK 21/Gradle wrapper/Android SDK 35, реализованы контракты и migration, debug APK и release-signing путь проверены сборкой. APK запускался в командной сборке, но отдельного Android emulator/device acceptance run не было; постоянная GitHub remote ещё не создана.

### Этап 1 — ядро MVP (код реализован; acceptance path не завершён)

Один Android-пользовательский путь: запросить реальный email OTP → подтвердить код → открыть текстовый диалог → отправить текст → получить ответ/сообщение второго клиента → закрыть/перезапустить приложение или временно отключить сеть → после восстановления сети увидеть согласованную историю без дублей. Включить нативные Compose-экраны, NestJS REST + Socket.IO, PostgreSQL, реальную почтовую доставку, Room с transactional outbox, OkHttp и WorkManager fallback, авторизацию, idempotency, server ack и REST catch-up по cursor. Для полноценной проверки нужен второй клиент (например, минимальный web-клиент или второй Android-клиент); web — отдельный клиент, не замена Android.

**Целевой критерий MVP (ещё не подтверждён целиком):** чистая установка API 26+, рабочая OTP доставка, два авторизованных клиента могут обменяться текстом, сервер сохраняет историю, повторная отправка не создаёт дубль, reconnect восстанавливает пропуски из REST, UI читает Room, а PR workflow собирает debug APK без signing secrets. Сейчас локально подтверждены build/tests/static integration; SMTP, persistent production DB, Android device install/runtime, multi-client/offline E2E и GitHub-hosted CI ещё ожидают внешние настройки.

### Этап 2 — доставка и удобство (после ядра)

FCM для уведомления-сигнала и запуска синхронизации, ротация/регистрация device token, расширение тестов на Google Play services и Android 13+ permission. Push не заменяет REST catch-up.

### Этап 3 — медиа

Выбрать и проверить конкретный S3-compatible provider, политику хранения/региона, лимиты, MIME/размер и CORS. Backend выдаёт короткоживущий presigned URL; клиент загружает напрямую. R2 в исследовании — условный кандидат, не выбранная и не настроенная услуга.

### Этап 4 — звонки

Отдельно выбрать SFU и среду (LiveKit Cloud только при наличии проверенного аккаунта/условий либо self-host), настроить NestJS token grants, Android/web SDK, signaling/ICE/TURN, разрешения камеры/микрофона и испытания из ограниченных сетей. Не блокировать текстовый MVP этими работами.

## 8. Открытые upstream-компоненты и лицензии, указанные в исследовании

Лицензии ниже приведены только для перечисленных в исследованиях upstream-репозиториев; это не аудит полной сборки или транзитивных зависимостей. Перед выпуском нужны проверка лицензий зависимостей и SBOM.

- Kotlin, AndroidX (включая Compose/Room/WorkManager), OkHttp, Firebase Android SDK, Prisma, AWS SDK JS v3, Firebase Admin Node SDK и указанные LiveKit SDK/server/components — **Apache-2.0**.
- NestJS, Socket.IO, Nodemailer, Next.js, React, openapi-typescript и Zod — **MIT**; `android-actions/setup-android` и указанные `actions/checkout`, `actions/setup-java`, `actions/upload-artifact` — **MIT**.
- Официальный `socketio/socket.io-client-java` указывает лицензию **MIT** и совместимость Java-клиента с Socket.IO 3.x/4.x; для Android он используется вместе с OkHttp REST-клиентом.
- GetStream `webrtc-android` — **Apache-2.0**; GetStream/webrtc — **BSD-3-Clause**; WebRTC Android README указывает отдельные лицензии upstream-компонентов и патчей, которые следует проверить перед использованием.
- TypeScript и репозиторий AsyncAPI specification — **Apache-2.0**. PostgreSQL upstream описан как permissive-разрешение с сохранением уведомлений и disclaimer, а не как указанная SPDX-строка в результатах исследования.
- Для `gradle/actions` исследование отмечает MIT для runner/basic caching и отдельные проприетарные условия Enhanced Caching; если нужен только open-source cache — отключить кэш или выбрать basic provider.

## 9. Исторический снимок блокеров из первоначального исследования

> Этот список зафиксирован до реализации и не является текущим status. Android toolchain и APK теперь проверены локально; актуальные результаты и оставшиеся внешние блокировки см. в [`TODO.md`](../TODO.md).

1. **Критическая блокировка: Android toolchain не подтверждён.** В проверенной среде `ANDROID_HOME`/`ANDROID_SDK_ROOT` пусты, `sdkmanager`, `adb`, `gradle` не обнаружены в PATH; найден `/usr/bin/java`, но его версия/пригодность не установлена. Не подтверждены JDK, SDK platforms/build-tools, Gradle wrapper, Android Studio, эмулятор/устройство, AGP/Kotlin/KSP и чистая сборка.
2. **Native starter mismatch:** Manus Mobile starter на Expo конфликтует с требованием Kotlin/Compose и запретом Expo/WebView. Нельзя считать его пригодным Android-основанием; наличие других путей интеграции не подтверждено.
3. **Backend E2E ещё не обеспечен:** не подтверждены REST/WS backend, PostgreSQL/test DB, рабочая доставка email, домен/подтверждённый отправитель, SMTP egress или production-статус провайдера. Без этого невозможно завершить реальный OTP→message E2E.
4. **Node/runtime и зависимости:** проверить поддерживаемый Node и совместимость выбранных версий. Результаты отмечают Nodemailer с требованием Node 20+, Prisma 8 — Node 24+ и статус release candidate на момент исследования; firebase-admin-node — Node >=22. Выбор общего runtime не подтверждён.
5. **Push не готов:** Firebase project, Android app registration/package name, `google-services.json`, серверные credentials и Google Play services не подтверждены. FCM требует Google Play services; тестовая среда должна иметь Google APIs/Play services. На Android 13+ нужен runtime POST_NOTIFICATIONS.
6. **Медиа не готово:** провайдер/bucket, credentials, доменные/региональные требования, CORS, ограничения и проверка совместимости presigned URL не подтверждены. Не считать R2 уже выбранным/оплаченным.
7. **Звонки не готовы:** signaling, TURN/STUN credentials, SFU/аккаунт, домен/TLS/IP/порты и сетевые испытания не подтверждены. WebRTC и GetStream/LiveKit не входят в ядро.
8. **Release signing не настроен:** нужны GitHub repository Actions, безопасно хранимый и резервируемый key material, закрытая настройка Environment/secrets и доверенный release workflow. Сборка release APK пока не подтверждена.
9. **Остальные технические решения:** не проверены реальные задержки/поведение Socket.IO за выбранным reverse proxy/load balancer, database backup/restore, ограничения хостинга и политика хранения данных. До масштаба MVP достаточно зафиксировать эти вопросы и проверить критичные для выбранного deployment target.

**Вывод:** сначала подтвердить нативный Android toolchain и создать чистую сборку Compose/API 26+, затем реализовать узкий текстовый E2E с OTP, PostgreSQL, REST + Socket.IO, Room/outbox и catch-up. FCM, медиа и звонки — отдельные будущие этапы; ни одно внешнее окружение в предоставленных результатах не считается уже доступным или настроенным.
