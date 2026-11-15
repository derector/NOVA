# NOVA backend

Модульный NestJS для NOVA Core API. PostgreSQL — основной источник данных. Socket.IO передаёт только уже сохранённые события сообщений и не является очередью для проигрывания пропущенных офлайн-событий.

## Локальный запуск

1. Установите Node.js 22. Скопируйте `.env.example` в локальный `.env`, замените `APP_SECRET` случайным закрытым значением длиной не менее 32 байт и настройте SMTP host/from (а также credentials SMTP, если нужны). Скрипты `start`, `start:dev` и `migrate` загружают `.env`, если он есть. Никогда не коммитьте `.env`.
2. Запустите PostgreSQL командой `docker compose up -d postgres`, затем установите закреплённые зависимости через `npm ci`.
3. Примените схему: `npm run migrate`; запустите API: `npm run start:dev`.
4. API расположен под `/api/v1`; Swagger UI — `/docs`. `GET /api/v1/health` проверяет PostgreSQL connectivity.

Если SMTP host/sender отсутствует или отправка письма завершилась ошибкой, OTP endpoint намеренно возвращает 503. Код OTP не возвращается и не пишется в логи. Аккаунт создаётся только после валидного challenge; тестовые seed-пользователи не добавляются. Refresh token используется однократно и ротируется, в БД хранится только HMAC hash. Личные чаты рассчитаны на двух пользователей; каждый REST/Socket.IO доступ к чату проверяет membership. После переподключения клиент восстанавливает события через REST cursor.

Для deployment необходимы PostgreSQL `DATABASE_URL`, приватный `APP_SECRET`, рабочий SMTP service/sender и необходимые SMTP credentials. Укажите `CORS_ORIGINS` как список точных разрешённых origins через запятую. Не заявляйте end-to-end готовность без live database и теста реальной SMTP-доставки.
