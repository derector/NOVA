# NOVA — статус реализации

Значение статусов: `NOT STARTED`, `IN DEVELOPMENT`, `IMPLEMENTED`, `TESTING`, `VERIFIED`, `BLOCKED`. `IMPLEMENTED` означает, что код готов, но полный acceptance-сценарий ещё не доказан. `VERIFIED` относится только к перечисленным ниже проверкам. Не заявлять готовность функции end-to-end без соответствующих результатов.

## 0. Нативная основа Android — IMPLEMENTED; проверка на устройстве ожидает

Нативный Kotlin + Jetpack Compose проект использует `applicationId=io.nova.app`, `minSdk=26`, `targetSdk=35`; это приложение в APK, а не оболочка WebView/Expo. Room хранит чаты, сообщения и outbox; WorkManager повторяет отправку при доступной сети с backoff; Android Keystore защищает локальный ключевой материал сессии.

На итоговом исходном коде локально успешно выполнены `:app:assembleDebug`, `:app:testDebugUnitTest`, проверка package/SDK metadata через AAPT и проверка подписи через `apksigner`. Debug APK размером 11 МБ подписан debug-ключом. Gradle release-конфигурация успешно собиралась и проверялась по подписи с временным тестовым keystore; тестовый ключ и release APK удалены. Не запускались установка/исполнение на Android emulator/device, проверка Android API 26 и миграция обновления существующей установки; production ключ подписи не предоставлен.

## 1. Backend, данные и API-контракт — IMPLEMENTED; DB integration/deployment ожидают

Реализованы модульный NestJS backend, PostgreSQL DDL/migration, validation, авторизованные endpoint-ы и Swagger/OpenAPI 3.1. Общий REST контракт — `shared/openapi.yaml`, события Socket.IO и правила reconnect/catch-up — `shared/events.md`. PostgreSQL хранит OTP challenges, sessions, accounts, участников личных чатов, сообщения и rate-limit buckets. SQL-параметры передаются отдельно; закрытые операции проверяют членство в чате.

Публичный поиск и участники чатов не выбирают и не возвращают email аккаунтов; regression-тесты проверяют оба пути. Локально успешно прошли TypeScript typecheck/build, 5 unit tests и npm audit (0 high-severity findings). Runtime Swagger отдал все 10 API paths; запрос с некорректным DTO завершился HTTP 400. В среде не было работающего PostgreSQL, поэтому фактическое выполнение migration, health с БД и DB-backed HTTP-сценарии не проверены. Workflow CI настроен на запуск PostgreSQL и этих smoke checks, но сам GitHub workflow ещё не запускался.

## 2. Email OTP, аккаунт, сессия и профиль — IMPLEMENTED; реальная SMTP-доставка заблокирована настройками

OTP генерируется криптографически стойким методом, хранится в HMAC-хеше, имеет короткий срок действия, одноразов и ограничен по попыткам/частоте. Refresh-токены ротируются, в базе хранится только keyed hash; access token живёт ограниченное время. Nodemailer подключён как реальный SMTP транспорт. Без SMTP host/sender или при ошибке доставки backend честно возвращает 503 и не показывает/логирует код, не имитируя успешную отправку. Профиль хранит username/display name. Email выдаётся только владельцу авторизованного аккаунта.

Нужны production `APP_SECRET`, PostgreSQL и действующий SMTP provider/sender/credentials, затем — проверка фактической доставки и подтверждения кода.

## 3. Личные сообщения двух пользователей и синхронизация — IMPLEMENTED; реальный E2E ожидает

REST API личных чатов работает с PostgreSQL и проверяет членство. Отправка использует UUID `Idempotency-Key`, долговременное подтверждение сервера и conflict при несовпадении payload для повторного ключа. Socket.IO публикует событие после сохранения. Android сначала записывает сообщение и outbox локально, показывает pending/failure и повторяет с прежним client message UUID. После reconnect запускается REST catch-up по cursor; Socket.IO не считается долговременной очередью. Web-клиент реализует поиск пользователей, создание/список чатов, историю, отправку, серверный ack и realtime/catch-up.

Ещё нужен сценарий с двумя реальными аккаунтами на разных Android/web-клиентах и живыми PostgreSQL/SMTP: online send, offline queue/retry, перезапуск процесса и проверка отсутствия дублей. Этот end-to-end сценарий не запускался.

## 4. Минимальный web-клиент — IMPLEMENTED; deployment/E2E ожидают

Отдельный Next.js/React/TypeScript frontend реализует email OTP, профиль, поиск по username, личный чат и текстовые сообщения через тот же API. Access token остаётся в памяти; из-за текущего body-based refresh API refresh token хранится в `sessionStorage`, а не `localStorage`. `sessionStorage` доступен JavaScript того же origin; до широкой production-поставки лучше перейти на `HttpOnly; Secure; SameSite` cookie с CSRF-защитой.

После финальных изменений успешно прошли web lint, TypeScript check, production build и npm dependency audit (0 findings).

## 5. HTTPS, secrets, GitHub remote и CI — IN DEVELOPMENT

Исходники опубликованы в публичном [`derector/NOVA`](https://github.com/derector/NOVA), ветка `main`; последний GitHub Actions run [43704156088](https://github.com/derector/NOVA/actions/runs/43704156088) прошёл. Hosted CI выполнил PostgreSQL migration и database health smoke, backend typecheck/unit tests/build/audit, web lint/typecheck/production build/audit и Android debug APK/JVM unit tests; Android APK artifact загружен. Release job штатно пропущен, поскольку запускается только на version tag и требует отдельно настроенных signing secrets/production HTTPS URL.

Backend нужно развернуть за публичным HTTPS/WSS; PostgreSQL должен надёжно сохранять данные. Публичный deployment target, SMTP provider и production PostgreSQL не настроены. OpenAPI privacy contracts проверены локально.

Release job потребует GitHub Environment `release`, публичную HTTPS GitHub Variable `NOVA_API_BASE_URL` и secrets `NOVA_RELEASE_KEY_BASE64`, `NOVA_RELEASE_STORE_PASSWORD`, `NOVA_RELEASE_KEY_ALIAS`, `NOVA_RELEASE_KEY_PASSWORD`. Выданный debug APK не является production release и настроен на Android Emulator API `http://10.0.2.2:3001`.

## 6. Медиа и группы — NOT STARTED

Будущий этап: постоянное S3-compatible хранилище с signed URL, проверками/повторами и metadata; затем группы, роли, приглашения и moderation.

## 7. Push и звонки — NOT STARTED

Будущий этап: FCM с настройками пользователя и минимальным содержимым push payload; WebRTC аудио/видео только после подготовки signaling, STUN/TURN и SFU и тестирования.

## 8. Остальные возможности соцсети — NOT STARTED

Поздние этапы: лента, посты, реакции, комментарии, подписки, каналы, сообщества, stories, уведомления, настройки приватности, модерация, жалобы, экспорт/удаление данных и явно согласованные AI/bot-функции. Не заявлять E2EE без проверенной реализации протокола; незаконченные функции не должны отображаться как нефункциональные декоративные кнопки.
