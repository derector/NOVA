# Передача проекта NOVA другому ИИ/разработчику

**Дата снимка:** 15 ноября 2026. Этот документ входит в handoff ZIP. Он описывает и публичную версию `main`, и локальные изменения, которые добавлены в копию `project/`, но ещё не опубликованы в GitHub.

## 1. О чём проект

Пользователь просил сделать **нативное Android-приложение в виде APK**, а не сайт вместо приложения. Согласованный первый вертикальный срез — нативный Kotlin/Jetpack Compose клиент, NestJS API, PostgreSQL, OTP по email, личные сообщения и дополнительный web-клиент. Первоисточник требований включён в архив как `NOVA_Full_Technical_Specification.txt`. Пользователь отдельно попросил изучить GitHub design-skills (`Taste Skill`, `UI UX Pro Max`, `Awesome Claude Design`, `Design Motion Principles`, `DESIGN.md Chrome`) и применять найденные проверенные практики; аудит и адаптированные правила лежат в `project/docs/design-skills-review.md` и `project/AGENTS.md`.

## 2. Файлы и репозиторий

Публичный репозиторий: <https://github.com/derector/NOVA>. Текущая remote-ветка `main` указывает на commit `9dde0253f09dd097b3bf67ad8ea3294e7440f28b`. Последний подтверждённый зелёный CI run этого commit: <https://github.com/derector/NOVA/actions/runs/43706740260> — backend/PostgreSQL/tests, web checks и Android debug APK прошли; release job пропущен по условию tag-only.

В ZIP папка `project/` — рабочая копия с более поздними изменениями: нативный login UI/валидация, версия Android `0.1.2`, Brevo SMTP рекомендации и TLS, постоянная Android debug signing configuration, CI проверки ключа и handoff-документы. Эти локальные изменения **ещё не запушены**. GitHub API для Repository Actions secrets возвращает `403 Resource not accessible by integration`. Не пытайтесь пушить CI-изменения до настройки Actions secrets: текущая Android debug job намеренно завершается ошибкой, если постоянный signing key отсутствует.

Ключевые файлы в `project/`:

- `android/` — Kotlin + Jetpack Compose APK; package `io.nova.app`, `minSdk=26`, `targetSdk=35`, `versionCode=3`, `versionName=0.1.2`.
- `backend/` — NestJS, PostgreSQL migrations, email OTP, REST/Socket.IO.
- `web/` — Next.js клиент для входа, профиля, поиска и сообщений.
- `shared/openapi.yaml`, `shared/events.md` — совместный REST/realtime контракты.
- `AGENTS.md`, `TODO.md` — инструкции и статусы.
- `docs/login-network-research.md` — подтверждённый диагноз телефона, Compose UI и Brevo SMTP с источниками.
- `docs/build-and-deploy.md` — локальная сборка, установка, deployment и подпись.

## 3. Почему email-вход не работает на телефоне

Показанный APK использует debug API URL `http://10.0.2.2:3001`. Это специальный адрес, через который **Android Emulator** обращается к loopback компьютера-разработчика; физический Xiaomi по нему не найдёт backend. В публичном интернете у проекта сейчас нет развернутого API и PostgreSQL. Поэтому запрос не доходит до сервера; даже полностью настроенный Brevo не исправит недоступный API host.

В локальной версии `0.1.2` улучшена форма: email validation до запроса, удобные email/OTP клавиатуры и IME действия, прокручиваемая форма при открытой клавиатуре, смена email и более точная ошибка для `10.0.2.2` на физическом телефоне. Ошибка не должна утверждать, что код отправлен. Изменения проверены компиляцией и 8 Android unit tests, но на реальном телефоне/emulator вручную не прогонялись.

Чтобы получить настоящий вход на телефоне, следующему исполнителю нужно развернуть API и PostgreSQL на доступном endpoint. Production должен быть доступен по HTTPS; затем собрать APK с `NOVA_API_BASE_URL=https://<публичный-api-host>`. Локальный Wi-Fi/LAN URL годится лишь для краткой отладки с телефоном и компьютером в одной сети.

## 4. Brevo может отправлять OTP

Да. NestJS backend уже использует Nodemailer; переписывать его под отдельный Brevo SDK не нужно. Для Brevo используйте:

- host: `smtp-relay.brevo.com`;
- port: `587`, `SMTP_SECURE=false`, обязательный STARTTLS; допустимая альтернатива Brevo — порт `2525`;
- username: точный SMTP login из раздела Brevo SMTP settings (он не обязательно совпадает с login email аккаунта);
- password: созданный **SMTP key**, не Brevo API key;
- `SMTP_FROM`: sender, добавленный/подтверждённый в Brevo; собственный домен следует аутентифицировать DKIM/DMARC.

Backend теперь принудительно требует TLS upgrade для портов 587/2525; письмо OTP локализовано на русский. `.env.example` содержит только неперсональные пояснения, никаких SMTP credentials в архиве нет. Секреты задаются только в deployment secret store; не вставляйте их в Android APK, public GitHub, этот ZIP или чат. Настроить Brevo/account/sender и развернуть API пользователь пока не поручал/не предоставил.

## 5. Постоянная подпись APK и обновление установленного приложения

Package ID во всех сборках должен оставаться `io.nova.app`, а `versionCode` — только расти. Предыдущие CI debug APK подписывались меняющимся ключом runners, поэтому Android мог отклонить новую сборку как конфликт подписи. Пользователь согласился **один раз удалить APK v0.1.1**: удаление сотрёт локальные данные приложения, зато после установки следующей сборки с постоянным сертификатом последующие APK смогут обновляться поверх.

Gradle уже проверен одноразовым тестовым JKS на чистой сборке: `signingReport` показал `Config: stableDebug`, а сертификат APK совпал с тестовым keystore по SHA-256. Тестовый ключ удалён. Для NOVA создан отдельный постоянный debug keystore; его публичный SHA-256 fingerprint: `83:9C:E1:02:C3:DC:CF:79:6A:1D:4D:7C:7C:CA:35:78:88:A2:88:66:98:D1:04:C7:B5:C8:1F:FC:97:19:8E:4B`.

**Приватная подпись не включена в ZIP и никогда не должна попадать в Git.** В текущем sandbox она хранится отдельно с правами `0600`:

- keystore: `/home/ubuntu/.cache/nova/nova-debug-signing.jks`;
- локальный секретный env-файл: `/home/ubuntu/.cache/nova/nova-debug-signing.env`.

Если следующий ИИ работает в том же cloud workspace, используйте существующий ключ, не создавайте новый и не выводите секретные переменные в лог. Если этих файлов больше нет, но key ещё не сохранён в GitHub Actions Secrets, остановитесь и попросите пользователя восстановить тот же ключ: новая подпись снова заставит удалять приложение.

Для workflow нужны **repository Actions secrets**: `NOVA_DEBUG_KEY_BASE64`, `NOVA_DEBUG_STORE_PASSWORD`, `NOVA_DEBUG_KEY_ALIAS`, `NOVA_DEBUG_KEY_PASSWORD`. В локальном закрытом env-файле уже подготовлены значения и base64 keystore. После того как пользователь действительно даст GitHub Actions Secrets write permission, безопасно загрузите их напрямую из этого env-файла через `gh secret set`, не печатая значения. Текущий `gh secret list --repo derector/NOVA` всё ещё возвращает 403, поэтому секреты пока не загружены.

CI в `project/.github/workflows/ci.yml` после настройки secrets декодирует keystore только во временную папку runner, принудительно пересобирает APK без build cache, сравнивает SHA-256 сертификата APK с сертификатом keystore и удаляет временный файл. В handoff ZIP приватного key нет. APK в архиве будет собран этим же постоянным ключом; перед его установкой удалите v0.1.1 один раз.

## 6. Что проверено, а что ещё нет

- Android локально: Kotlin/Compose debug build проходит; 8/8 JVM unit tests; package/version metadata и APK signature проверяются. Чистая стабильная подпись тестовым keystore совпала по fingerprint.
- Backend локально после Brevo/TLS изменения: typecheck, build, 5/5 unit tests и `npm audit --audit-level=high` прошли; живых SMTP credentials нет, поэтому реальная доставка не подтверждена.
- Публичный GitHub CI: зелёный для remote commit `9dde025` (до более поздних локальных изменений); результаты не переносить на текущую локальную рабочую копию.
- Нет настоящего device/E2E теста, публичного backend, production PostgreSQL, настроенного Brevo sender/domain, публичного сайта или релизного production keystore.

## 7. Рекомендуемый порядок следующей работы

1. Проверьте `project/` и переданные attachments; не опирайтесь только на public `main`, потому что исправления `0.1.2` пока в handoff snapshot.
2. Убедитесь, что тот же постоянный keystore доступен. После подключения GitHub Actions Secrets загрузите четыре `NOVA_DEBUG_*` values из локального защищённого env-файла, затем запустите CI. Проверьте fingerprint перед выдачей APK.
3. Попросите пользователя один раз удалить прежний `io.nova.app` v0.1.1 (предупредив о потере локальных данных), установите v0.1.2 и проверьте, что launcher icon фирменная.
4. Настройте backend runtime, PostgreSQL, `APP_SECRET`, Brevo sender/domain и SMTP key в серверных secrets; проверьте `/api/v1/health`, реальную доставку OTP, подтверждение кода и повторный вход.
5. Соберите Android APK с публичным HTTPS API URL и протестируйте на физическом телефоне. После проверки обновите статусы, source ZIP, SHA-256 и GitHub `main`.

