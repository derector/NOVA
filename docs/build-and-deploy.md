# NOVA — сборка, запуск и release

## Текущий объём и требования

Этот guide описывает нативный Android APK, NestJS/PostgreSQL API и дополнительный web-клиент. Он не означает, что публичный API, SMTP или полноценная соцсеть уже развёрнуты. Для локальной разработки нужны Node.js 22, PostgreSQL, JDK 21, Android SDK platform/build-tools 35 и доступ к разрешённым зависимостям. Production дополнительно требует постоянный HTTPS API, PostgreSQL и реальные backend secrets.

## Backend и Brevo SMTP

В каталоге `backend/`:

1. Скопируйте `.env.example` в локальный `.env`. Замените шаблонный `APP_SECRET` на закрытое случайное значение не короче 32 байт, настройте PostgreSQL URL и никогда не коммитьте `.env`.
2. Для Brevo задайте `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER` как точный SMTP login из страницы SMTP в Brevo, `SMTP_PASSWORD` как Brevo **SMTP key (не API key)** и `SMTP_FROM` как sender, подтверждённый в Brevo. Для лучшей доставляемости используйте свой домен с настроенными DKIM/DMARC. Секреты храните только на сервере в secret store.
3. Запустите PostgreSQL командой `docker compose up -d postgres`, установите зависимости через `npm ci`, выполните `npm run migrate` и стартуйте API `npm run start:dev`.
4. API слушает порт `3001`; `GET /api/v1/health` проверяет доступность PostgreSQL, Swagger UI в non-production режиме доступен по `/docs`.

Nodemailer использует STARTTLS для порта 587 и теперь требует TLS upgrade на портах 587/2525. На порту 465 Brevo использует implicit TLS (`SMTP_SECURE=true`). Без реального SMTP sender/credentials OTP endpoint возвращает 503. Brevo доставляет почту, но не запускает API и не делает его доступным телефону.

## Web и Android

Web: из `web/` выполните `npm ci && npm run dev`. Next.js стартует на `http://localhost:3000`, API по умолчанию ожидается на `http://localhost:3001`. Другой API origin задаётся через `NEXT_PUBLIC_NOVA_API_BASE_URL`; безопасный шаблон находится в `web/.env.example`. Публичного web deployment пока нет.

Android: нативное приложение Kotlin/Jetpack Compose, package `io.nova.app`, `minSdk=26`, `targetSdk=35`, версия исходной рабочей копии `0.1.2` (`versionCode=3`). Фирменная adaptive/round иконка и улучшенная форма email/OTP уже в исходниках.

- Эмулятор по умолчанию использует `http://10.0.2.2:3001`.
- **Физический телефон не может использовать `10.0.2.2` как адрес компьютера.** Ему нужен публичный HTTPS API URL; краткая локальная отладка допускает доступный телефону LAN IP с компьютером и телефоном в одной Wi-Fi сети.
- При локальной сборке другой API origin задаётся через `NOVA_API_BASE_URL`, например `NOVA_API_BASE_URL=https://<api-host> ./gradlew --no-daemon :app:assembleDebug`. В production/release проект требует HTTPS.
- Перед сборкой, которую надо установить поверх предыдущей, всегда проверьте, что package ID и signing certificate не менялись. `versionCode` только увеличивайте.

### Обновление установленного APK и debug-подпись

Старый APK v0.1.1 был подписан меняющимся CI debug certificate. Пользователь согласился один раз удалить v0.1.1; удаление приложения сотрёт локальные данные. Новый APK v0.1.2 собирается с выделенным постоянным debug keystore. После его установки последующие debug APK смогут устанавливаться поверх **только если** подпись в CI/local build останется этим же keystore.

Для текущего handoff sandbox приватный keystore хранится отдельно от проекта: `/home/ubuntu/.cache/nova/nova-debug-signing.jks`; защищённые значения и base64 содержатся в `/home/ubuntu/.cache/nova/nova-debug-signing.env` с правами `0600`. **Ни один из этих файлов не входит в handoff ZIP, Git или публичный репозиторий.** Не создавайте новый key, если хотите сохранить возможность обновления уже установленного v0.1.2.

Для Android debug CI в GitHub нужны repository Actions secrets `NOVA_DEBUG_KEY_BASE64`, `NOVA_DEBUG_STORE_PASSWORD`, `NOVA_DEBUG_KEY_ALIAS`, `NOVA_DEBUG_KEY_PASSWORD`. Workflow временно декодирует JKS, проверяет, что SHA-256 сертификата APK совпадает с сертификатом ключа, удаляет JKS и собирает APK с `--no-build-cache --rerun-tasks`. На последнюю проверку GitHub API всё ещё отвечал 403 на Secrets; пока пользователь не предоставит нужное право, новую workflow версию нельзя публиковать и считать CI успешным. Если файлы ключа утрачены и key ещё не в Secrets, остановитесь и попросите пользователя восстановить тот же key — не создавайте замену.

## CI и GitHub

Публичный репозиторий: [github.com/derector/NOVA](https://github.com/derector/NOVA). Последний подтверждённый зелёный run для публичной ветки до локальных изменений — [43706740260](https://github.com/derector/NOVA/actions/runs/43706740260), commit `9dde025`. В нём прошли backend/PostgreSQL migration/smoke, web lint/typecheck/build/audit и Android debug APK/unit tests; release job был штатно skipped.

Локальная копия `project/` в handoff ZIP содержит более поздние изменения login UI, Brevo transport/security, v0.1.2 и stable signing. Они ещё не отправлены в публичный `main`: после настройки GitHub Actions Secrets повторно проверьте workflow YAML, отправьте исходники, дождитесь зелёного CI и проверьте подписанный APK artifact.

## Production release APK

Debug-подпись и production release keystore — разные ключи. Не храните release keystore или password в репозитории, APK, Gradle файле или handoff ZIP. В GitHub настройте защищённый Environment `release`, публичную variable `NOVA_API_BASE_URL` со значением production `https://` API origin и Environment secrets:

- `NOVA_RELEASE_KEY_BASE64`;
- `NOVA_RELEASE_STORE_PASSWORD`;
- `NOVA_RELEASE_KEY_ALIAS`;
- `NOVA_RELEASE_KEY_PASSWORD`.

Добавляйте tag `v…` только после проверки production backend, SMTP, HTTPS и migration. CI временно декодирует release keystore на runner, подписывает APK, проверяет его и удаляет временный файл. Для production updates используйте один и тот же release keystore и увеличивайте `versionCode`; debug APK не может обновлять release APK и наоборот.

## Границы подтверждений

Успешная компиляция и unit tests не подтверждают реальную SMTP-доставку, публичный backend, переписку двух пользователей, установку на телефон, offline-поведение или обновление приложения. После deployment отдельно проверьте доступность `/api/v1/health`, получение Brevo OTP, подтверждение кода и Android update поверх v0.1.2 с тем же fingerprint.
