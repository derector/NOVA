# NOVA

NOVA — коммуникационный продукт. Текущий MVP-срез состоит из нативного Android APK, NestJS/PostgreSQL API и отдельного Next.js web-клиента для сценария двух пользователей и текстового сообщения. Android-приложение — APK, а не WebView.

## Структура

- `android/` — Kotlin + Jetpack Compose, package `io.nova.app`, собственная adaptive/round иконка, локальная очередь сообщений и экран email/OTP.
- `backend/` — NestJS API, PostgreSQL migrations, REST и Socket.IO; отправка кода через SMTP/Nodemailer.
- `web/` — отдельный Next.js/React/TypeScript клиент.
- `shared/` — OpenAPI и realtime-контракты.
- `AGENTS.md` — проектные дизайн- и UI/accessibility правила, собранные из проверенных открытых руководств.
- `docs/` — архитектура, сборка, GitHub design-source review и диагностика входа/Brevo.
- `.github/workflows/ci.yml` — GitHub Actions для backend, web, native APK, unit tests и защищённого release.

## Статус handoff

В локальном дереве приложения — версия `0.1.2` (`versionCode=3`): добавлена фирменная иконка, улучшена форма email/OTP, локальная проверка email и клавиатурное действие, а ошибка недоступного API сообщает, что `10.0.2.2` подходит Android Emulator, но не физическому телефону. Нативная сборка проверена локально; Android unit tests — 8/8.

Последний зелёный GitHub Actions run [43706740260](https://github.com/derector/NOVA/actions/runs/43706740260) проверял публичный `main` на commit `9dde025`; release job штатно пропущен. Исправления login/Brevo/stable signing после этой ревизии пока находятся в локальном дереве и handoff-архиве, не в публичном `main`. Для stable debug подписи уже настроена Gradle/CI поддержка; добавление Actions secrets сейчас блокируется ответом GitHub API `403`.

**Вход с физического телефона пока не может завершиться:** публичный backend не развёрнут, а debug URL `http://10.0.2.2:3001` указывает на host Android Emulator. Brevo можно использовать без нового SDK: backend уже использует Nodemailer, но нужны SMTP key, подтверждённый sender/домен, PostgreSQL и API по публичному HTTPS. Не вводите SMTP key в APK, этот README или чат.

Для перехода с предыдущего APK v0.1.1 потребуется согласованное одноразовое удаление старой debug-версии; оно удалит локальные данные приложения. Следующий APK и последующие обновления должны быть собраны с одним и тем же постоянным debug-keystore. APK ещё не проверен установкой на реальный Android device.

## Передача следующему разработчику

Начните с [handoff guide](docs/HANDOFF_RU.md), затем прочитайте [AGENTS.md](AGENTS.md), [TODO.md](TODO.md), [сборку/установку](docs/build-and-deploy.md) и [диагностику сети, формы и Brevo](docs/login-network-research.md). Сводка открытых дизайн-репозиториев находится в [design-skills-review.md](docs/design-skills-review.md).

Публичный репозиторий: [github.com/derector/NOVA](https://github.com/derector/NOVA). Не коммитьте `.env`, SMTP credentials, keystore, base64-ключи или production database URL; `.gitignore` исключает локальные секреты и build outputs.
