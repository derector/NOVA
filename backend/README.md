# NOVA backend

Модульный NestJS для NOVA Core API. PostgreSQL — основной источник данных. Socket.IO передаёт только уже сохранённые события сообщений и не является очередью для проигрывания пропущенных офлайн-событий.

## Локальный запуск

1. Установите Node.js 22. Скопируйте `.env.example` в локальный `.env` и замените `APP_SECRET` случайным закрытым значением длиной не менее 32 байт.
2. Запустите PostgreSQL командой `docker compose up -d postgres`, затем установите закреплённые зависимости через `npm ci`.
3. Примените схему командой `npm run migrate`; запустите API через `npm run start:dev`.
4. API находится под `/api/v1`; Swagger UI — `/docs`. `GET /api/v1/health` проверяет доступность PostgreSQL.

### Отправка кодов через Brevo

Backend уже использует Nodemailer и принимает стандартные SMTP-параметры. Для Brevo в локальном `.env` задайте `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER` равным точному SMTP login из раздела SMTP в Brevo, а `SMTP_PASSWORD` — созданному Brevo **SMTP key**, не API key. `SMTP_FROM` должен быть sender, подтверждённым в Brevo. Для отправителя с собственного домена настройте доменную аутентификацию DKIM/DMARC. Порт 587 использует STARTTLS; backend требует успешный TLS upgrade для портов 587 и 2525.

SMTP key показывается при создании только один раз. Храните его в защищённом secret store deployment-среды; не коммитьте `.env`, не включайте key в APK, не публикуйте в GitHub и не отправляйте в чат. Значения-подсказки есть в `.env.example`.

Если SMTP host/from не настроены или отправка завершается ошибкой, OTP endpoint намеренно возвращает 503. Код не возвращается клиенту и не пишется в логи. Аккаунт создаётся только после валидного challenge; тестовые seed-пользователи не добавляются. Refresh token используется однократно и ротируется, в БД хранится только HMAC hash. Личные чаты рассчитаны на двух пользователей; каждый REST/Socket.IO доступ к чату проверяет membership. После переподключения клиент восстанавливает события через REST cursor.

Для deployment необходимы PostgreSQL `DATABASE_URL`, приватный `APP_SECRET`, публичный API endpoint, рабочий SMTP service/sender и SMTP credentials. Brevo настраивает только доставку SMTP: backend всё равно должен быть запущен и доступен телефону по HTTPS. Укажите `CORS_ORIGINS` как список точных разрешённых origins через запятую. Не заявляйте end-to-end готовность без live database и теста реальной SMTP-доставки.
