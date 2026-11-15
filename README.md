# NOVA

NOVA — коммуникационный продукт. Сейчас реализован первый вертикальный срез: нативное Android-приложение, NestJS/PostgreSQL API и отдельный небольшой web-клиент для сценария двух пользователей и текстового сообщения. Android-клиент — APK, не WebView.

## Структура проекта

- `android/` — Kotlin + Jetpack Compose (`applicationId=io.nova.app`, `minSdk=26`), включая adaptive/round launcher icons.
- `backend/` — NestJS API, PostgreSQL migrations, REST и Socket.IO.
- `web/` — отдельный клиент Next.js/React/TypeScript.
- `shared/` — OpenAPI-контракт и описание realtime-событий.
- `AGENTS.md` — постоянные instructions для безопасной разработки NOVA UI на Android и web.
- `docs/` — архитектура, запуск/release, открытые источники и их лицензии.
- `.github/workflows/ci.yml` — GitHub Actions для backend, web, Android debug APK и защищённой release-сборки.

## Текущий статус

Android APK обновлён до версии `0.1.1` (`versionCode=2`). В манифест добавлена собственная adaptive и round launcher icon NOVA — мятный фон и тёмная буква N. Локальная сборка, AAPT icon metadata и `apksigner` прошли проверку; commit с иконкой прошёл полный [GitHub Actions run 43705547258](https://github.com/derector/NOVA/actions/runs/43705547258), включая backend/PostgreSQL migration и health smoke, web checks, Android APK и unit tests. Release job пропускается на обычном push и требует отдельной production-подписи.

Выданный APK — debug/test build, подписанный debug-сертификатом, не production release. Email-вход на телефоне **не заработает**, пока к приложению не подключён публично доступный backend и не настроен настоящий SMTP-провайдер. В текущем debug APK `http://10.0.2.2:3001` работает только для Android Emulator с backend на машине-разработчике. Web-клиент есть в исходниках, но публичный сайт пока не развёрнут.

## Разработка и проверки

Перед UI-изменениями используйте [инструкции проекта](AGENTS.md). В них адаптированы безопасные практики для Android и Next.js из пяти проверенных GitHub-источников. Обзор репозиториев, лицензий, применимости и ограничений: [design skills review](docs/design-skills-review.md). История архитектурных решений и границы реализации: [TODO.md](TODO.md) и [architecture.md](docs/architecture.md). Команды запуска и сборки: [build-and-deploy.md](docs/build-and-deploy.md).

Не добавляйте в репозиторий SMTP credentials, `APP_SECRET`, production database URL, ключи Firebase/object storage или Android release keystore. Email — приватные данные аккаунта: публичный поиск и участники чатов получают только ID, username и display name.
