# NOVA — статус реализации

Значение статусов: `NOT STARTED`, `IN DEVELOPMENT`, `IMPLEMENTED`, `TESTING`, `VERIFIED`, `BLOCKED`. `IMPLEMENTED` означает, что код готов, но полный acceptance-сценарий ещё не доказан. `VERIFIED` относится только к перечисленным ниже проверкам. Не заявлять готовность функции end-to-end без соответствующих результатов.

## 0. Нативная основа Android — IMPLEMENTED; device/E2E проверка ожидает

Kotlin + Jetpack Compose, package `io.nova.app`, `minSdk=26`, `targetSdk=35`, `versionCode=3`, `versionName=0.1.2`. Это нативный APK, не WebView/Expo. Manifest содержит adaptive и round launcher icons NOVA. Room хранит чаты/сообщения/outbox; WorkManager повторяет передачу с backoff при сети; Android Keystore защищает токены приложения. Email/OTP экран улучшен: проверка email до запроса, email/числовая клавиатура и IME actions, обработка открытой клавиатуры/прокрутки, смена email и сообщение о недоступном `10.0.2.2` на физическом устройстве.

Текущая локальная копия успешно собрана через `:app:assembleDebug`; `:app:testDebugUnitTest` прошёл 8/8, AAPT metadata и APK signature проверены. Чистая сборка с одноразовым тестовым JKS сначала подтвердила `Config: stableDebug` и совпадение SHA-256; тестовый ключ затем удалён. Финальный локальный APK v0.1.2 собран с отдельным постоянным NOVA debug-keystore; fingerprint APK совпадает с keystore. Сам JKS, пароли и base64 находятся вне Git и handoff ZIP. Четыре GitHub Actions Secrets для этой подписи ещё не записаны: GitHub secrets API возвращает 403, поэтому hosted CI для текущего APK не запускался. Ранее установленный v0.1.1 потребует согласованного пользователем однократного удаления (локальные данные пропадут); после установки v0.1.2 нельзя менять ключ подписи будущих обновлений. На реальном устройстве и API 26 приложение не тестировалось.

## 1. Backend, данные и API-контракт — IMPLEMENTED; production integration ожидает

Реализованы NestJS модули, PostgreSQL DDL/migrations, validation, защищённые REST endpoints и Swagger/OpenAPI 3.1. Общий REST контракт — `shared/openapi.yaml`, Socket.IO и reconnect/catch-up — `shared/events.md`. PostgreSQL хранит OTP challenges, sessions, accounts, membership личных чатов, сообщения и rate-limit buckets. SQL параметризован, закрытые операции проверяют членство. Публичный поиск и участники чатов не возвращают email; regression tests охватывают оба пути.

Локально после обновлений Nodemailer/STARTTLS прошли backend TypeScript typecheck, build, 5 unit tests и `npm audit --audit-level=high` без high severity findings. Последний зелёный hosted GitHub CI — run [43706740260](https://github.com/derector/NOVA/actions/runs/43706740260) на старом публичном commit `9dde025`; он выполнил PostgreSQL migrations/database health smoke, backend и web checks, Android build/tests. Более поздние локальные изменения ещё не пушились. Production database/API и две реальные учётные записи не настроены; full chat E2E не выполнен.

## 2. Email OTP, аккаунт, сессия и профиль — IMPLEMENTED; живой вход ожидает deployment/credentials

OTP генерируется криптографически стойко, хранится HMAC-хешем, одноразов, короткоживущ и ограничен по попыткам/частоте. Refresh-токены ротируются и хранятся keyed hash; access token ограничен по времени. Nodemailer готов к Brevo SMTP: host `smtp-relay.brevo.com`, port 587 с принудительным STARTTLS, точный Brevo SMTP login, SMTP key (не API key), подтверждённый sender. SMTP-письмо русскоязычное. Без рабочей SMTP-доставки API честно возвращает 503 и не раскрывает код. Email виден только владельцу аккаунта.

Физический телефон также нуждается в публичном доступном API: `10.0.2.2` — адрес Android Emulator, не реального телефона. Нужны публичный HTTPS backend, PostgreSQL, `APP_SECRET`, серверные SMTP credentials и подтверждённый sender/domain. Успешная реальная доставка OTP и подтверждение кода пока не тестировались.

## 3. Личные сообщения двух пользователей и синхронизация — IMPLEMENTED; E2E ожидает

REST API личных чатов работает с PostgreSQL и проверяет membership. Отправка использует UUID `Idempotency-Key`, подтверждение сервера и конфликт при несовпадающем повторном payload. Socket.IO публикует сообщение после сохранения. Android сохраняет сообщение/outbox локально, отображает pending/failure и повторяет с прежним client UUID. После reconnect клиент делает REST catch-up по cursor; Socket.IO не является долговременной очередью. Web-клиент реализует username search, создание/список чатов, историю, отправку, ack и realtime catch-up.

Требуется сценарий с двумя пользователями на Android/web при активных PostgreSQL/SMTP: online send, offline queue/retry, перезапуск процесса и отсутствие дублей. Такой end-to-end сценарий не выполнялся.

Typing/presence vertical slice added locally: authenticated `presence:heartbeat` leases use bounded TTL, `presence:update` is emitted only to authorized chat rooms, multiple sockets for one user are handled, and `typing:set` is membership-checked with automatic expiry. Web sends/receives the events and shows online/last-seen and typing state; Android sends heartbeat and typing state from the native Compose composer. Current store is single-instance in-process TTL; replacing it with Redis is required before horizontal scaling.

## 4. Минимальный web-клиент — IMPLEMENTED; deployment/E2E ожидают

Отдельный Next.js/React/TypeScript frontend реализует email OTP, профиль, поиск по username, личный чат и text messages через тот же API. Access token остаётся в памяти; body-based refresh API хранит refresh token в `sessionStorage`, не в `localStorage`. `sessionStorage` доступен JavaScript на том же origin; до production лучше перейти на `HttpOnly; Secure; SameSite` cookie с CSRF-защитой.

Последний зелёный hosted CI проверял web lint, TypeScript, production build и dependency audit (0 findings). Публичный web deployment не настроен.

## 5. HTTPS, secrets, GitHub remote и CI — IN DEVELOPMENT; секреты/production отсутствуют

Публичный репозиторий: [`derector/NOVA`](https://github.com/derector/NOVA), `main`. Последний зелёный run [43706740260](https://github.com/derector/NOVA/actions/runs/43706740260) относится к remote commit `9dde025`. Handoff ZIP содержит локальные изменения после этого commit; они не запушены. Текущая локальная workflow поддерживает стабильную debug подпись, пересборку без кеша и проверку совпадения fingerprint. Перед push нужно загрузить четыре repository Actions secrets: `NOVA_DEBUG_KEY_BASE64`, `NOVA_DEBUG_STORE_PASSWORD`, `NOVA_DEBUG_KEY_ALIAS`, `NOVA_DEBUG_KEY_PASSWORD`. Сейчас GitHub API отвечает 403 на secrets list/write; не заявлять зелёный CI для локальных изменений и не менять signing key.

Backend нужно развернуть за публичным HTTPS/WSS; PostgreSQL должен сохранять данные. Публичный API/site host, SMTP provider/account credentials/sender и production database ещё не настроены. См. [handoff guide](docs/HANDOFF_RU.md), [network/Brevo research](docs/login-network-research.md) и [build/deploy guide](docs/build-and-deploy.md).

Production release отдельно требует GitHub Environment `release`, публичную variable `NOVA_API_BASE_URL` с HTTPS URL и secrets `NOVA_RELEASE_KEY_BASE64`, `NOVA_RELEASE_STORE_PASSWORD`, `NOVA_RELEASE_KEY_ALIAS`, `NOVA_RELEASE_KEY_PASSWORD`. Debug key и release key — разные credentials.

## 6. Медиа и группы — NOT STARTED

Будущий этап: постоянное S3-compatible хранилище с signed URL, проверками/повторами и metadata; затем группы, роли, приглашения и moderation.

## 7. Push и звонки — NOT STARTED

Будущий этап: FCM с настройками пользователя и минимальным содержимым push payload; WebRTC audio/video только после подготовки signaling, STUN/TURN и SFU и тестирования.

## 8. Остальные возможности соцсети — NOT STARTED

Поздние этапы: лента, посты, реакции, комментарии, подписки, каналы, сообщества, stories, уведомления, настройки приватности, модерация, жалобы, экспорт/удаление данных и явно согласованные AI/bot-функции. Не заявлять E2EE без проверенной реализации протокола; незаконченные функции не должны отображаться как нефункциональные декоративные кнопки.

## 9. Staging-проверка ядра — TESTING; production ожидает

15 ноября 2026 в sandbox развёрнут staging: PostgreSQL 16, локальный SMTP catcher на `127.0.0.1:1025`, NestJS API и Next.js web через временные HTTPS forwarding URLs. Подробный отчёт — [`docs/staging-verification.md`](docs/staging-verification.md).

Фактически пройдено: backend typecheck/build и 5/5 unit tests; web lint/typecheck/build; Android `assembleDebug` и 8/8 JVM tests; API E2E 20/20 (OTP для трёх аккаунтов, ротация refresh token, поиск без email, личный чат, идемпотентность, 409 при конфликте, 403 для не-участника); Socket.IO `message:new` 3/3; вход, поиск и отправка сообщения через web UI. APK собран для staging API `https://3001-…manus.computer` и подписан debug-сертификатом sandbox, а не прежним NOVA stable debug key; как обновление поверх прежней установки он не годится.

Исправлена гонка realtime: аутентификация Socket.IO перенесена из `handleConnection` в middleware `afterInit`, чтобы `chat:join` сразу после connect не приходил до установки `client.data.userId`.

Не проверено: установка на физический телефон, реальная доставка Brevo, production API/PostgreSQL/TLS, GitHub Actions для текущего commit, release keystore и обновление APK поверх предыдущей версии.
