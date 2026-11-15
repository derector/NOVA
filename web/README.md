# NOVA Web E2E client

Отдельный Next.js App Router клиент для первого реального сценария email OTP → профиль → личный чат → текстовые сообщения. Медиа, группы, звонки, лента, push и другие ещё не реализованные области не заявлены как готовые.

## Запуск

```sh
npm ci
npm run dev
```

Web-приложение запускается Next.js на `http://localhost:3000`, API backend по умолчанию ожидается на `http://localhost:3001`. Другой origin задаётся `NEXT_PUBLIC_NOVA_API_BASE_URL`; это публичный адрес backend, не секрет. Переменные провайдера почты и серверные credentials не помещаются в клиентский пакет или в `NEXT_PUBLIC_*`.

Реальная OTP доставка требует настроенного backend и email provider; при отсутствии настроек backend честно возвращает 503, а клиент объясняет, что код не отправлен.

## Ограничение web-сессии

Согласно текущему API-контракту endpoint refresh принимает refresh token в JSON body. Клиент держит короткоживущий access token в памяти и refresh token только в `sessionStorage` (не `localStorage`). `sessionStorage` доступен JavaScript на том же origin и слабее `HttpOnly; Secure; SameSite` cookie. Перед production web-релизом следует перейти на cookie-based refresh с CSRF-защитой, чтобы JavaScript не получал refresh token.

## Проверки

```sh
npm run lint
npm run typecheck
npm run build
```

REST DTO, `Idempotency-Key`, `after` cursor и Socket.IO события описаны в `../shared/openapi.yaml` и `../shared/events.md`. REST сохраняет сообщения и выполняет catch-up после reconnect; Socket.IO используется для real-time обновлений и не гарантирует replay во время отключения.
