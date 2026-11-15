# NOVA — сборка, запуск и release

## Текущий объём и требования

Инструкции относятся к первому реализованному вертикальному срезу. Они не означают, что публичный API, почтовый provider или полноценная соцсеть уже развёрнуты. Для локальной разработки нужны Node.js 22, PostgreSQL, JDK 21, Android SDK platform/build-tools 35 и интернет для разрешённых зависимостей. Для production release дополнительно нужны личный Android keystore и публичный HTTPS URL API.

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

## CI

`.github/workflows/ci.yml` закрепляет GitHub Actions полными commit SHA. В workflow настроено следующее:

- backend typecheck/unit tests/build/audit; PostgreSQL service, миграция и database health smoke;
- web lint/typecheck/production build/audit;
- Android debug APK и JVM unit tests, с загрузкой APK как artifact;
- отдельный release job по version tag, защищённый GitHub Environment.

Workflow хранится в локальном дереве, но не запускался на GitHub: активный GitHub token не имеет разрешения создать новый репозиторий.

## Подписанный release APK

Не храните release keystore или пароль в репозитории, Gradle-файле или APK. В GitHub настройте защищённый Environment `release`, публичную переменную `NOVA_API_BASE_URL` со значением production `https://` API origin и такие Environment secrets:

- `NOVA_RELEASE_KEY_BASE64` — содержимое Android keystore в base64;
- `NOVA_RELEASE_STORE_PASSWORD`;
- `NOVA_RELEASE_KEY_ALIAS`;
- `NOVA_RELEASE_KEY_PASSWORD`.

Добавляйте tag версии `v…` только после проверки production backend и миграции. CI временно декодирует keystore на runner, собирает и проверяет release APK, загружает его как artifact и удаляет временный файл ключа. Для обновлений сохраняйте тот же keystore/alias и увеличивайте `versionCode`. Локальный debug APK подписан другим ключом и не может заменять production-подпись при обновлении.

## Границы подтверждений

Успешная компиляция и unit tests не подтверждают SMTP-доставку, публичный хостинг, переписку двух аккаунтов, установку/работу на Android, offline-поведение или обновление уже установленной версии. Перед заявлением production-ready проведите и задокументируйте эти acceptance-тесты отдельно.
