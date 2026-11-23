# NOVA — сборка, запуск и release

## Требования

Для локальной разработки нужны Node.js 22, PostgreSQL, JDK 21, Android SDK platform/build-tools 35 и интернет для разрешённых зависимостей. Для production release дополнительно нужны личный Android keystore и публичный HTTPS URL API.

## Backend

В каталоге `backend/`:

1. Создайте локальный `.env` на основе `.env.example`; не коммитьте его. Замените шаблонный `APP_SECRET` на закрытое случайное значение не короче 32 байт и настройте PostgreSQL URL.
2. Укажите настоящий SMTP host/sender и необходимые credentials. Пока они не настроены, запрос OTP возвращает HTTP 503.
3. Запустите PostgreSQL командой `docker compose up -d postgres`.
4. Выполните `npm ci`, затем `npm run migrate` и `npm run start:dev`.
5. API по умолчанию слушает порт `3001`. `GET /api/v1/health` проверяет доступность базы; Swagger UI в non-production режиме доступен по `/docs`.

Production требует управляемую PostgreSQL, защищённые secrets, ingress с HTTPS/WSS, резервные копии/retention и реальный transactional email provider. Сейчас публичного deployment нет.

## Web и Android

Web: из `web/` выполните `npm ci && npm run dev`. Next.js запустится на `http://localhost:3000`, API по умолчанию ожидается на `http://localhost:3001`. Другой адрес указывается в `NEXT_PUBLIC_NOVA_API_BASE_URL`; безопасный шаблон находится в `web/.env.example`.

Android: из `android/` выполните `./gradlew :app:assembleDebug :app:testDebugUnitTest`. Для Android Emulator debug URL по умолчанию — `http://10.0.2.2:3001`; другой backend задаётся через `NOVA_API_BASE_URL`. Незашифрованный HTTP разрешён только в debug-сборке.

APK включает adaptive и round launcher icon NOVA. При проверке сборки проверьте ресурсы обеих иконок.

> **Важно при установке:** APK из CI подписывается debug-ключом, который может меняться между запусками. Из-за этого новая debug-сборка может не устанавливаться поверх ранее скачанного APK. Удаление старой версии перед установкой удалит её локальные данные; для безопасного обновления будущих версий нужен постоянный release signing key.

## Два проекта Vercel

| Проект | Root Directory | Переменные |
| --- | --- | --- |
| Веб-клиент NOVA | `web` (Next.js, Node 22) | `NEXT_PUBLIC_NOVA_API_BASE_URL`, `NEXT_PUBLIC_NOVA_SITE_URL`, `NEXT_PUBLIC_NOVA_DOWNLOAD_URL` |
| Сайт загрузки NOVA | `download` (Other, Node 22) | `NOVA_DOWNLOAD_ORIGIN`, `NOVA_MESSENGER_ORIGIN`, `NOVA_UPDATE_MANIFEST_URL`, `NOVA_RELEASE_CERT_SHA256` |

Запускайте NestJS на хосте с постоянным процессом и Socket.IO через HTTPS/WSS. Настройте `CORS_ORIGINS` точными origin веб-клиента, SMTP и отдельную PostgreSQL. Перед подключением основного домена проверьте регистрацию, переписку и звонки между двумя аккаунтами. Для звонков через сети с ограничениями NAT настройте TURN. [Звонки в NOVA](browser-calls.md)

У обоих сайтов есть `robots.txt` и `sitemap.xml`. После подключения доменов добавьте оба публичных адреса как ресурсы Google Search Console, подтвердите владение и отправьте их sitemap. Приватные чаты остаются за входом. [Документация Google Search Central](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)

## CI

`.github/workflows/ci.yml` закрепляет GitHub Actions полными commit SHA. В workflow настроено следующее:

- backend typecheck/unit tests/build/audit; PostgreSQL service, миграция и database health smoke;
- web lint/typecheck/production build/audit;
- download site manifest contract tests and production build;
- Android debug APK и JVM unit tests, с загрузкой APK как artifact;
- отдельный release job по version tag, защищённый GitHub Environment.

Workflow опубликован в [GitHub-репозитории NOVA](https://github.com/derector/NOVA). Run [43705547258](https://github.com/derector/NOVA/actions/runs/43705547258) прошёл после изменения Android icon resources: PostgreSQL migration и database health smoke, backend checks, web lint/typecheck/build/audit, Android debug assembly/unit tests и artifact upload. Signed release job не запускался, поскольку его условие — version tag `v…`; для него также требуются production HTTPS API URL и настроенный signing keystore в GitHub Environment.

## Подписанный release APK

Не храните release keystore или пароль в репозитории, Gradle-файле или APK. В GitHub настройте защищённый Environment `release` и его публичные переменные.

| Переменная | Значение |
| --- | --- |
| `NOVA_API_BASE_URL` | Production HTTPS-адрес API |
| `NOVA_UPDATE_MANIFEST_URL` | Публичный HTTPS-адрес `latest.json` |
| `NOVA_APK_PUBLIC_BASE_URL` | Публичный HTTPS-каталог версионированных APK |
| `NOVA_RELEASE_CERT_SHA256` | SHA-256 сертификата постоянного release-ключа, 64 шестнадцатеричных символа |
| `NOVA_MINIMUM_VERSION_CODE` | Необязательный минимальный поддерживаемый `versionCode`. По умолчанию 0, при котором обновления остаются добровольными |

Настройте Environment secrets.

- `NOVA_RELEASE_KEY_BASE64` — содержимое Android keystore в base64;
- `NOVA_RELEASE_STORE_PASSWORD`;
- `NOVA_RELEASE_KEY_ALIAS`;
- `NOVA_RELEASE_KEY_PASSWORD`.

Добавляйте tag `v<versionName>` после проверки production backend и миграции. CI временно декодирует keystore на runner, проверяет пакет, минимальный Android SDK, номер версии и сертификат, сохраняет APK и `latest.json` в artifact `nova-release-apk` и удаляет временный файл ключа. Для обновлений сохраняйте тот же keystore/alias и увеличивайте `versionCode`. Для проверки пути обновления между тестовыми сборками подпишите обе одним тестовым ключом.

Публикуйте версионированный APK первым, затем проверяйте скачивание и SHA-256 по адресу `apkUrl`. После этого публикуйте `latest.json` по адресу `NOVA_UPDATE_MANIFEST_URL` и подключайте его же к сайту скачивания. Храните версионированный APK по неизменному адресу, а для `latest.json` задайте короткое время кэширования или перепроверку при запросе.

Клиент проверяет манифест при открытии и запускает фоновую проверку с WorkManager примерно раз в четыре часа. Android может отложить фоновую проверку для экономии заряда. Уведомления можно включить в настройках приложения. После загрузки приложение проверяет размер, SHA-256, пакет, номер версии и соответствие сертификата установленному NOVA. Установку подтверждает пользователь в системном установщике Android.

## Границы подтверждений

Успешная компиляция и unit tests не подтверждают SMTP-доставку, публичный хостинг, переписку двух аккаунтов, установку/работу на Android, offline-поведение или обновление уже установленной версии. Перед заявлением production-ready проведите и задокументируйте эти acceptance-тесты отдельно.
