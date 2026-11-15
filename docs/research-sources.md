# NOVA — открытые upstream-проекты и источники

Здесь перечислены upstream-проекты, которые реально используются в первом срезе кода. Указанные версии закреплены в Gradle или npm manifest/lockfile; это не заявление, что каждая из них является самой новой. Целое приложение или готовый чат-шаблон из внешнего репозитория не копировались.

## Нативный Android

- [Kotlin](https://github.com/JetBrains/kotlin) и [AndroidX](https://github.com/androidx/androidx) предоставляют язык и платформенные библиотеки. Используются Jetpack Compose (BOM `2024.12.01`), Room `2.6.1`, WorkManager `2.10.0` и Lifecycle `2.8.7`; см. официальные документы [Compose](https://developer.android.com/develop/ui/compose), [Room](https://developer.android.com/training/data-storage/room) и [WorkManager](https://developer.android.com/topic/libraries/architecture/workmanager).
- [OkHttp](https://github.com/square/okhttp) (`4.12.0`) — HTTP-клиент; [Gson](https://github.com/google/gson) (`2.11.0`) сериализует JSON.
- Нативный клиент подключается к [socketio/socket.io-client-java](https://github.com/socketio/socket.io-client-java) (`2.1.1`) — upstream Java/Android-compatible Socket.IO client. Клиент использует API, совместимый с Socket.IO сервером версии 4.x; обычный WebSocket-клиент не является заменой этого протокола.
- [Android Keystore](https://developer.android.com/privacy-and-security/keystore) защищает локальный key material; поведение Room/Keystore — код NOVA, а не сторонняя sync-библиотека.

## Backend и web

- [NestJS](https://github.com/nestjs/nest) (`11.2.10`) — модульный HTTP/WebSocket framework. Официальная [документация gateway](https://docs.nestjs.com/websockets/gateways) описывает realtime integration point.
- [node-postgres / `pg`](https://github.com/brianc/node-postgres) (`8.16.3`) подключается к PostgreSQL. NOVA использует parameterized SQL и собственные versioned migrations, а не Prisma.
- [Socket.IO](https://github.com/socketio/socket.io) (`4.8.1`) передаёт live events. Сохранение сообщений и reconnect catch-up реализованы через PostgreSQL/REST, потому что realtime event сам по себе не является постоянной очередью; см. [delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/).
- [Nodemailer](https://github.com/nodemailer/nodemailer) (`10.5.0`) — только SMTP transport. Реальная доставка требует настроить provider, sender и secrets.
- [Next.js](https://github.com/vercel/next.js) (`16.4.6`) и [React](https://github.com/facebook/react) (`19.3.1`) — отдельный browser client; [socket.io-client](https://github.com/socketio/socket.io-client) (`4.8.1`) использует тот же событийный протокол.

## Сборка и CI

Workflow `.github/workflows/ci.yml` закрепляет используемые Actions полными commit SHA вместо изменяемых тегов: [actions/checkout](https://github.com/actions/checkout), [actions/setup-java](https://github.com/actions/setup-java), [actions/setup-node](https://github.com/actions/setup-node), [android-actions/setup-android](https://github.com/android-actions/setup-android), [actions/upload-artifact](https://github.com/actions/upload-artifact). Официальная [инструкция Android command-line build](https://developer.android.com/studio/build/building-cmdline) объясняет сборку через SDK/wrapper.

## Лицензии и безопасность — границы аудита

Upstream-репозитории публикуют собственные лицензии; проект обращается к их API как к зависимостям. Это **не** полный license review или Software Bill of Materials (SBOM) прямых и транзитивных Maven/npm-зависимостей. В финальном локальном запуске `npm audit` сообщил 0 findings для backend и web деревьев зависимостей; Android Gradle dependencies не прошли эквивалентный полный SCA/license scan. Перед production distribution сформируйте и проверьте SBOM, подтвердите лицензии/notice obligations, включая транзитивные артефакты, и повторно просканируйте точные release lockfiles.
