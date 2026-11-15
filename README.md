# NOVA

NOVA — социальный коммуникационный продукт. Текущая версия — первый вертикальный срез, а не готовая социальная сеть: нативное Android-приложение, базовый NestJS/PostgreSQL API и отдельный небольшой web-клиент для сценария двух пользователей и текстового сообщения. Android-клиент — APK, не WebView-сайт.

## Структура проекта

- `android/` — Kotlin + Jetpack Compose (`applicationId=io.nova.app`, `minSdk=26`), без Expo/WebView.
- `backend/` — модульный NestJS backend, PostgreSQL migrations, REST API с версиями и realtime через Socket.IO.
- `web/` — отдельный клиент Next.js/React/TypeScript.
- `shared/` — общий OpenAPI-контракт и описание realtime-событий.
- `docs/` — архитектура, инструкции запуска/выпуска и ссылки на выбранные открытые upstream-проекты.
- `.github/workflows/ci.yml` — GitHub Actions CI для backend, web, Android debug APK и защищённой release-сборки.

## Текущий статус

Android debug APK собирается, JVM unit tests проходят. Это APK для разработки/тестирования, подписанный debug-сертификатом; он **не является production release APK**. Проверены backend typecheck/build/unit tests и web lint/typecheck/production build. Для npm-зависимостей backend и web audit не выявил уязвимостей на момент последней локальной проверки.

Исходники опубликованы в публичном [GitHub-репозитории derector/NOVA](https://github.com/derector/NOVA), ветка `main`, commit `f465075`. [GitHub Actions run](https://github.com/derector/NOVA/actions/runs/43703832657) успешно выполнил backend/PostgreSQL миграцию и health smoke, web lint/typecheck/build/audit, Android debug APK и JVM unit tests; debug APK загружен как artifact. Release job пропущен по условию version tag и не является production release. Реальная отправка OTP, production hosting, HTTPS/WSS API и сквозной обмен между двумя клиентами ещё не проверены. Production APK потребует настроенных hosting/SMTP, своего защищённого signing key и публичного HTTPS API URL.

Подробный объём и границы проверок перечислены в [`TODO.md`](TODO.md), запуск/сборка/подпись — в [`docs/build-and-deploy.md`](docs/build-and-deploy.md), а выбранные открытые репозитории и ограничения аудита — в [`docs/research-sources.md`](docs/research-sources.md).

## Секреты и приватность

Не добавляйте в репозиторий SMTP credentials, `APP_SECRET`, production database URL, ключи Firebase/object storage или Android release keystore. Email — приватные данные аккаунта: публичный поиск и участники чатов получают только ID, username и display name.
