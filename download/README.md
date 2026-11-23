# NOVA для Android

Отдельный проект Vercel. Укажите `download` как Root Directory, Framework Preset Other и Node.js 22. Команда `npm run build` собирает страницу в `dist/`. Запрос `/api/release` обрабатывает Vercel Function. Локально весь маршрут можно запустить через `vercel dev`. Проверки манифеста запускаются командой `npm test`.

## Настройки проекта

| Переменная | Значение |
| --- | --- |
| `NOVA_DOWNLOAD_ORIGIN` | Публичный HTTPS origin этого сайта для canonical и sitemap. |
| `NOVA_MESSENGER_ORIGIN` | HTTPS origin веб-мессенджера для ссылки «Открыть NOVA». |
| `NOVA_GOOGLE_SITE_VERIFICATION` | Необязательное значение `content` метатега Search Console для ресурса с префиксом URL. Для доменного ресурса используйте DNS TXT. |
| `NOVA_UPDATE_MANIFEST_URL` | Публичный HTTPS URL того же `latest.json`, который читает Android. Endpoint должен отдавать JSON без редиректа. |
| `NOVA_RELEASE_CERT_SHA256` | SHA-256 сертификата production-подписи в виде 64 шестнадцатеричных символов без разделителей. |

Загрузите production APK по неизменяемому HTTPS URL с версией, затем опубликуйте соответствующий подписанной сборке `latest.json`. Страница берёт текущие сведения о версии из этого манифеста. Пока публичной сборки нет, страница показывает её статус. Preview-сборки и сборки без действующего canonical закрыты для индексации.

После публикации добавьте адрес сайта в Google Search Console, подтвердите право управления и отправьте `<origin>/sitemap.xml`. Для Search Console нужен доступ владельца к проекту или DNS.

## Скриншоты Android

Снимите экраны на реальном Android или эмуляторе с проверенной сборкой, без личных данных. Положите PNG/WebP в `src/screenshots/`. В `src/screenshots.json` укажите массив объектов с полями `file`, `alt`, `caption`, `width`, `height`. Сборка включит галерею, когда появятся снимки.

## Документация

- Настройки корневого каталога, сборки и вывода проекта. [Vercel Project Configuration](https://vercel.com/docs/project-configuration)
- Требования к абсолютным адресам и отправка sitemap. [Google Search Central](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- Метатег, DNS и другие способы подтверждения права управления. [Google Search Console](https://support.google.com/webmasters/answer/9008080)
