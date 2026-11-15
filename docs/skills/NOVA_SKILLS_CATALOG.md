# NOVA Skills — проверенный каталог

**Дата проверки:** 15 ноября 2026. **Стек:** Android Kotlin/Jetpack Compose, Next.js/React/TypeScript, NestJS/Node.js, PostgreSQL, Socket.IO, Redis, GitHub Actions.

Каждый навык ниже — реальный репозиторий с `SKILL.md`, который был открыт при проверке. Для каждой записи независимо проверены прямая ссылка на `SKILL.md`, файл лицензии и дата последнего коммита. Указаны зависимости, замечания по безопасности и команда установки для Codex. Ничего из перечисленного не устанавливалось и не запускалось: это каталог проверенных кандидатов.

## Сводка

| Tier | Найдено |
|---|---:|
| Обязательные (mandatory) | 14 |
| Рекомендуемые (recommended) | 33 |
| Дополнительные (optional) | 4 |
| Проверено записей | 51 |
| Исключено после проверки | 1 |

## Обязательные навыки (14)

### android-accessibility

- **Категории:** Accessibility
- **Репозиторий:** https://github.com/new-silvermoon/awesome-android-agent-skills
- **SKILL.md:** https://raw.githubusercontent.com/new-silvermoon/awesome-android-agent-skills/main/.github/skills/ui/android-accessibility/SKILL.md
- **Назначение:** Чеклист аудита Android accessibility именно для Jetpack Compose: contentDescription, декоративные изображения, touch target 48dp, WCAG contrast, focus order, merged semantics, stateDescription, headings и TalkBack.
- **Совместимость с NOVA:** Прямая совместимость с нативным Android APK NOVA на Kotlin + Jetpack Compose; не требует Expo/React Native/Flutter и отдельно затрагивает screen reader/TalkBack, фокус и контраст.
- **Лицензия:** Apache-2.0; проверено по https://raw.githubusercontent.com/new-silvermoon/awesome-android-agent-skills/main/LICENSE. Исходное описание: Apache-2.0; copyright holder в LICENSE не указан явно (видимый текст начинается с условий лицензии).
- **Последнее обновление:** 2026-07-27T21:51:10Z (первый updated в https://github.com/new-silvermoon/awesome-android-agent-skills/commits/main.atom)
- **Зависимости:** не заявлены; skill является инструкциями и примерами для Compose semantics, без package/runtime install.
- **Безопасность:** scripts/ и install-файлы в дереве не обнаружены. SKILL.md не содержит shell-команд, сетевых обращений, доступа к файлам, curl|bash или запросов токенов; только статический чеклист. Ничего не запускалось.
- **Установка для Codex:** Codex не документирован; вручную: git clone https://github.com/new-silvermoon/awesome-android-agent-skills ~/.codex/skills/awesome-android-agent-skills и использовать .github/skills/ui/android-accessibility/.
- **Проверка ссылки:** ok
- **Примечание:** Самый прямой кандидат для Android-части NOVA: raw SKILL.md, Apache LICENSE и Atom подтверждены curl. Название репозитория содержит awesome, но это не агрегатор без skill: внутри существует собственный проверенный SKILL.md.

### jetpack-compose-performance

- **Категории:** Android Engineering
- **Репозиторий:** https://github.com/android/skills
- **SKILL.md:** https://raw.githubusercontent.com/android/skills/main/jetpack-compose/jetpack-compose-performance/SKILL.md
- **Назначение:** Официальный Android skill для аудита и оптимизации производительности Jetpack Compose: состояние и стабильность, layout/lazy layouts, эффекты, графика, Modifier.Node, baseline profiles и release-профилирование.
- **Совместимость с NOVA:** Прямо совместим с нативным Android на Kotlin + Jetpack Compose; применим к Material 3 UI и экрану личных сообщений NOVA. Не относится к Next.js/Node backend.
- **Лицензия:** Apache-2.0; проверено по https://raw.githubusercontent.com/android/skills/main/LICENSE.txt. Исходное описание: Apache-2.0; в LICENSE.txt виден стандартный текст лицензии, отдельный copyright holder в файле не указан.
- **Последнее обновление:** 2026-11-15T16:05:42Z (первый <updated> из https://github.com/android/skills/commits/main.atom)
- **Зависимости:** Android Studio/AndroidX Compose API и проектные исходники; для рекомендаций упоминаются Compose Compiler/Runtime, R8 и Baseline Profiles. CLI/пакеты не заявлены для самого skill.
- **Безопасность:** В проверенном SKILL.md install-команд, curl|bash, scripts/ и запросов токенов нет. Skill предполагает чтение/анализ файлов Android-проекта и references; сетевой доступ нужен только если агент отдельно открывает указанные AndroidX-документы.
- **Установка для Codex:** Репозиторий документирует: `codex plugin marketplace add android/skills` затем `codex plugin add android-skills@android-skills`.
- **Проверка ссылки:** ok
- **Примечание:** Официальный репозиторий организации android; SKILL.md и Codex plugin подтверждены raw.githubusercontent.com/ github README. Закрывает критичную Compose-область, но не является общим signing/release skill.

### security-and-hardening

- **Категории:** Authentication and Security
- **Репозиторий:** https://github.com/addyosmani/agent-skills
- **SKILL.md:** https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/security-and-hardening/SKILL.md
- **Назначение:** Production-oriented security hardening for untrusted input, authentication and session flows, secrets, authorization, dependency/supply-chain risk, secure storage, and OWASP-style review. Directly useful for the NestJS API, Next.js web client, Socket.IO/WebSocket boundaries, GitHub Actions, and OTP/JWT design review.
- **Совместимость с NOVA:** Compatible with NOVA's Next.js/React/TypeScript and NestJS/Node.js stack; principles also apply to Kotlin Android and CI/CD. It is framework-guidance rather than a Kotlin-specific implementation.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/addyosmani/agent-skills/main/LICENSE. Исходное описание: MIT; copyright holder Addy Osmani (verified from https://raw.githubusercontent.com/addyosmani/agent-skills/main/LICENSE).
- **Последнее обновление:** 2026-11-14T04:33:55Z (first updated in https://github.com/addyosmani/agent-skills/commits/main.atom)
- **Зависимости:** No runtime dependencies declared by SKILL.md; references the workspace package manager/lockfile, CI, dependency audit tooling, and repository reference files as applicable.
- **Безопасность:** Repository contains scripts/ and install-related CI/test files, but this skill itself is guidance. It emphasizes blocking dependency scripts, inspecting before approval, secret scanning, authorization checks, secure sessions, and treating external input as hostile. No curl|bash instruction or token request was found in the checked skill. Do not run repository scripts or installers during adoption.
- **Установка для Codex:** `npx skills add addyosmani/agent-skills --skill security-and-hardening (the repository README documents npx skills add addyosmani/agent-skills and per-skill --skill installation).`
- **Проверка ссылки:** ok
- **Примечание:** Strongest general security baseline for NOVA. It does not provide a ready-made OTP service or JWT rotation module, so implementation-specific design remains required.

### nestjs-architecture-principles

- **Категории:** Backend Engineering
- **Репозиторий:** https://github.com/amirtaherkhani/nestjs-skills
- **SKILL.md:** https://raw.githubusercontent.com/amirtaherkhani/nestjs-skills/main/skills/nestjs-architecture-principles/SKILL.md
- **Назначение:** Проектирование и ревью NestJS-модулей, границ capability, dependency direction, ports/adapters, data/transaction ownership и устранение циклических зависимостей.
- **Совместимость с NOVA:** Прямо совместим с NestJS + Node.js + PostgreSQL + Redis NOVA: рекомендует pragmatic modular monolith, малые публичные API модулей и transport adapters для HTTP/WebSocket. Не навязывает CQRS или microservices без давления требований.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/amirtaherkhani/nestjs-skills/main/LICENSE. Исходное описание: MIT; copyright holder: amirtaherkhani (raw LICENSE: Copyright (c) 2026 amirtaherkhani).
- **Последнее обновление:** 2026-11-14T06:39:09Z (первый updated в https://github.com/amirtaherkhani/nestjs-skills/commits/main.atom; API pushed_at: 2026-11-14T06:39:23Z)
- **Зависимости:** Не заявлены runtime-пакеты; требуется доступ агента к package.json, nest-cli.json, TypeScript-конфигурации, bootstrap и исходным модулям целевого NestJS-проекта.
- **Безопасность:** Репозиторий содержит scripts/ и документированные npm-команды; не запускались. SKILL.md требует проверять security, contracts, persistence и transport boundaries; рекомендует не импортировать HTTP/ORM/vendor SDK в domain code. curl|bash и запросы токенов не заявлены; анализирует файлы проекта.
- **Установка для Codex:** Документировано README репозитория: npx skills add amirtaherkhani/nestjs-skills --skill nestjs-architecture-principles --agent codex; для глобальной установки README допускает --global.
- **Проверка ссылки:** ok
- **Примечание:** Критично для modular architecture NOVA и границ REST/WebSocket/DB/Redis. Это отдельный skill в том же лицензированном репозитории, не дубликат implementation skill.

### nestjs-professional-software-engineering

- **Категории:** Backend Engineering
- **Репозиторий:** https://github.com/amirtaherkhani/nestjs-skills
- **SKILL.md:** https://raw.githubusercontent.com/amirtaherkhani/nestjs-skills/main/skills/nestjs-professional-software-engineering/SKILL.md
- **Назначение:** Основной implementation skill для NestJS: инспекция существующего проекта, version-compatible реализация, тестирование, validation, API ergonomics и безопасная проверка изменений.
- **Совместимость с NOVA:** Прямо совместим с backend NOVA на NestJS + Node.js + TypeScript; охватывает API, DTO/validation, тесты и согласование с архитектурными skill. Не относится к Android, Next.js UI или React Native.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/amirtaherkhani/nestjs-skills/main/LICENSE. Исходное описание: MIT; copyright holder: amirtaherkhani (указан в raw LICENSE как Copyright (c) 2026 amirtaherkhani).
- **Последнее обновление:** 2026-11-14T06:39:09Z (первый updated в https://github.com/amirtaherkhani/nestjs-skills/commits/main.atom; API pushed_at: 2026-11-14T06:39:23Z)
- **Зависимости:** Необходим агент, умеющий читать/изменять репозиторий и запускать его штатные проверки; конкретные runtime-пакеты не заявлены. Skill требует читать package.json, TypeScript/Nest-конфигурацию и официальную документацию при version-sensitive вопросах.
- **Безопасность:** В репозитории есть scripts/ и README документирует npm install/npm test и другие npm-команды; они не запускались. В SKILL.md предписаны input validation, защита чувствительных данных, явная обработка ошибок и проверка authorization. curl|bash, запросы токенов и сетевой установщик в проверенном SKILL.md не заявлены; работа предполагает чтение файлов проекта и потенциально запуск его штатных проверок только по отдельному разрешению.
- **Установка для Codex:** Документировано самим репозиторием: npx skills add amirtaherkhani/nestjs-skills --skill nestjs-professional-software-engineering --agent codex (для пользовательской установки также указан --global).
- **Проверка ссылки:** ok
- **Примечание:** Прямое попадание в критичную область реализации NestJS backend/API; skill явно владеет implementation, API ergonomics, testing и verification. Подтверждены SKILL.md и raw LICENSE чтением через curl/fetch; команды не выполнялись.

### postgresql-best-practices

- **Категории:** Database Engineering
- **Репозиторий:** https://github.com/microsoft/postgres-skills
- **SKILL.md:** https://raw.githubusercontent.com/microsoft/postgres-skills/main/plugin/skills/postgresql-best-practices/SKILL.md
- **Назначение:** Маршрутизация и практические рекомендации по PostgreSQL: таблицы, индексы, JSONB, партиционирование, RLS, полнотекстовый поиск, connection pooling, репликация, backup и безопасные операции; содержит отдельные правила для managed PostgreSQL/Azure.
- **Совместимость с NOVA:** Прямо совместим с PostgreSQL-частью NOVA и backend NestJS/Node.js через SQL/драйвер или ORM; рекомендации по индексам, pool и миграционным изменениям применимы к CI/CD GitHub Actions. Не является runtime-библиотекой и не меняет стек Android/web.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/microsoft/postgres-skills/main/LICENSE. Исходное описание: MIT; copyright holder: Microsoft Corporation (LICENSE: Copyright (c) 2025 Microsoft Corporation).
- **Последнее обновление:** 2026-11-13T21:52:52Z (Atom: https://github.com/microsoft/postgres-skills/commits/main.atom)
- **Зависимости:** Node.js LTS и npx нужны для bundled postgres-mcp/plugin; для live database нужен PostgreSQL и настроенное соединение. Azure CLI опционален для Azure-сценариев. Для skills-only установка MCP не ставит. Точные версии пакетов в SKILL.md не заявлены.
- **Безопасность:** В SKILL.md заявлены read-only/least-privilege, явное подтверждение перед write, защита от секретов и трактовка DB-контента как недоверенного. В репозитории есть plugin/SETUP.md и scripts/ внутри migrate-oracle-app (скрипты не запускались). Установка через npx обращается к npm registry; bundled MCP обращается к выбранной БД, Azure-сценарии могут обращаться к Azure после аутентификации. Токен/пароль вводится скрытым prompt по документации, автоматически не запрашивался.
- **Установка для Codex:** Документировано самим README: `codex plugin marketplace add microsoft/postgres-skills` затем `codex plugin add postgres-skills@postgres-skills`; для skills-only также `npx skills add microsoft/postgres-skills --full-depth`.
- **Проверка ссылки:** ok
- **Примечание:** Проверены raw SKILL.md, raw LICENSE и Atom; сильнейший кандидат для PostgreSQL schema/indexing/query safety. Репозиторий содержит несколько skills, выбран именно postgresql-best-practices, не Oracle/graph.

### Material Design 3 Skill

- **Категории:** Design Systems
- **Репозиторий:** https://github.com/hamen/material-3-skill
- **SKILL.md:** https://raw.githubusercontent.com/hamen/material-3-skill/master/skills/material-3/SKILL.md
- **Назначение:** Material 3/Material You guidance for tokens, 30+ components, Compose-first Android theming, dynamic color, adaptive layouts, M3 Expressive, accessibility and compliance audits. Useful as the shared design-system contract for NOVA Android UI.
- **Совместимость с NOVA:** Directly compatible with native Kotlin + Jetpack Compose + Gradle. Web guidance is secondary; Flutter sections should be ignored for NOVA. Covers MaterialTheme, ColorScheme, Typography, Shapes, WindowInsets, adaptive navigation and approximately 48dp touch targets.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/hamen/material-3-skill/master/LICENSE. Исходное описание: MIT; copyright holder CWTI Ltd (shown in LICENSE).
- **Последнее обновление:** 2026-07-15T22:10:48Z (first updated entry in https://github.com/hamen/material-3-skill/commits/master.atom; API pushed_at also 2026-07-15T22:10:50Z).
- **Зависимости:** No runtime package dependency is declared for the skill itself. Guidance references native AndroidX Compose Material 3 APIs/BOM, Material Theme Builder concepts, and optionally @material/web for the separate web section. The README also uses the npx skills CLI for installation.
- **Безопасность:** No scripts/ directory was present in the repository tree. README documents npx --yes skills add and git clone/symlink installation; these commands access the network and write skill files, but were not run. SKILL.md describes optional browser/live-site research and reading project files; no token request or curl|bash installer was documented.
- **Установка для Codex:** Documented by the repository: `npx --yes skills add hamen/material-3-skill --skill material-3 -y`. It also documents manual Codex setup: `git clone https://github.com/hamen/material-3-skill.git`, then `mkdir -p ~/.codex/skills` and link/copy `skills/material-3` to `~/.codex/skills/material-3`.
- **Проверка ссылки:** ok
- **Примечание:** Strongest shared Material 3 token/component baseline for NOVA; the Compose section is explicitly primary. SKILL.md and LICENSE were fetched successfully from raw.githubusercontent.com; no installer was executed.

### deployment-patterns

- **Категории:** DevOps and CI/CD
- **Репозиторий:** https://github.com/affaan-m/ECC
- **SKILL.md:** https://raw.githubusercontent.com/affaan-m/ECC/main/skills/deployment-patterns/SKILL.md
- **Назначение:** Практические шаблоны deployment для web/backend: GitHub Actions CI/CD, multi-stage Docker, health/readiness checks, rolling/blue-green/canary deployment, rollback, production readiness и monitoring checklist.
- **Совместимость с NOVA:** Высокая совместимость с Next.js/React/TypeScript и NestJS/Node.js; примеры GitHub Actions используют npm и Docker/ghcr.io. Для Kotlin/Gradle APK skill не специализирован.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/affaan-m/ECC/main/LICENSE. Исходное описание: MIT; copyright holder: Affaan Mustafa (видно в LICENSE).
- **Последнее обновление:** 2026-11-06T21:21:50Z (первый updated в https://github.com/affaan-m/ECC/commits/main.atom)
- **Зависимости:** Node.js/npm (npm ci, npm run lint/typecheck/test/build), Docker Buildx и Docker registry; опционально kubectl, Vercel CLI, Railway CLI, Prisma CLI, Kubernetes/Compose. В runtime-примерах также Go, Python/uv/gunicorn для других стеков.
- **Безопасность:** В репозитории обнаружены install.sh и scripts/. SKILL.md содержит shell-команды Docker/kubectl/CLI и примеры переменных DATABASE_URL, REDIS_URL, API_KEY, JWT_SECRET; рекомендует secrets manager и не хранить secrets в image. curl|bash и запрос токенов не документированы в проверенном SKILL.md. Команды не запускались.
- **Установка для Codex:** Codex не документирован в проверенных материалах; вручную: git clone https://github.com/affaan-m/ECC ~/.codex/skills/ecc и использовать skill из skills/deployment-patterns/.
- **Проверка ссылки:** ok
- **Примечание:** Прямой raw SKILL.md и LICENSE открыты через curl; дата взята из Atom, а не из поисковой выдачи. Особенно полезен для GitHub Actions, Docker, health checks и rollback NOVA backend/web.

### Compose Expert

- **Категории:** Mobile UI/UX
- **Репозиторий:** https://github.com/aldefy/compose-skill
- **SKILL.md:** https://raw.githubusercontent.com/aldefy/compose-skill/master/skills/compose-expert/SKILL.md
- **Назначение:** Deep Jetpack Compose implementation and review guidance covering Material 3 theming/motion, accessibility, adaptive layouts, navigation, state, performance, atomic design systems, design tokens and design-to-code workflows, backed by AndroidX/Compose source receipts.
- **Совместимость с NOVA:** Directly applicable to NOVA's Kotlin + Jetpack Compose Android client. It also covers Compose Multiplatform, Desktop, iOS, Web, TV, Wear and XR; those portions are optional and should not change NOVA's native Android stack.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/aldefy/compose-skill/master/LICENSE. Исходное описание: MIT; copyright holder Adit Lal (shown in LICENSE).
- **Последнее обновление:** 2026-11-07T13:50:31Z (first updated entry in https://github.com/aldefy/compose-skill/commits/master.atom; API pushed_at 2026-11-07T13:50:39Z).
- **Зависимости:** No runtime dependency is required by the Markdown skill. Documentation references AndroidX/Jetpack Compose, Compose Material 3, Compose Multiplatform and JetBrains source repositories; the repository includes source/reference Markdown receipts. Installation may use Claude/Copilot plugin infrastructure or a Git submodule.
- **Безопасность:** Repository contains a scripts/ directory with validation/check scripts (`scripts/*.sh`, `.py`, `.bats`); none were run. README documents plugin commands, git clone/copy, and Codex `git submodule add`, all of which access network and/or write files. No curl|bash installer or token request was found in the inspected documentation. The skill references project auto-detection and optional GitHub PR review, so host-agent access may include local files/network when invoked.
- **Установка для Codex:** README documents Codex CLI manual installation via an `AGENTS.md` instruction and `git submodule add https://github.com/aldefy/compose-skill.git .compose-skill`; it also documents copying `skills/compose-expert` into an agent skill directory. Codex-specific command is not an npx installer; follow the repository's documented submodule/manual path.
- **Проверка ссылки:** ok
- **Примечание:** Most technically comprehensive Compose candidate and especially relevant to NOVA's component library, tokens, accessibility and Material 3 implementation. The raw path is the nested `skills/compose-expert/SKILL.md`; the root `SKILL.md` does not exist, so the nested URL must be used.

### performance

- **Категории:** Performance Engineering
- **Репозиторий:** https://github.com/addyosmani/web-quality-skills
- **SKILL.md:** https://raw.githubusercontent.com/addyosmani/web-quality-skills/main/skills/performance/SKILL.md
- **Назначение:** Evidence-led оптимизация загрузки и runtime performance: field/lab measurement, browser traces, critical rendering path, resource delivery, caching, code splitting и budgets.
- **Совместимость с NOVA:** Совместим с Next.js/React и переносит измерительный подход на framework-agnostic web; README отдельно упоминает React/Next.js, next/image, React.lazy, Suspense, useCallback/useMemo и Core Web Vitals.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/addyosmani/web-quality-skills/main/LICENSE. Исходное описание: MIT; copyright holder: Addy Osmani (подтверждено https://raw.githubusercontent.com/addyosmani/web-quality-skills/main/LICENSE).
- **Последнее обновление:** 2026-08-24T21:07:36Z (GitHub API pushed_at; default branch main)
- **Зависимости:** Опционально Chrome DevTools MCP, Lighthouse CLI, PageSpeed Insights/CrUX, browser performance trace; SKILL.md также упоминает RUM/PerformanceObserver. Базовые зависимости проекта не заявлены.
- **Безопасность:** SKILL.md предлагает browser traces, CrUX/PageSpeed и DevTools MCP, то есть возможны сетевые обращения; обязательных install-команд, scripts, curl|bash и запросов токенов в skill не обнаружено. В репозитории найден scripts/analyze.sh для web-quality-audit, но он не относится к выбранному skill и не запускался.
- **Установка для Codex:** `codex plugin marketplace add addyosmani/web-quality-skills. README также документирует npx skills add addyosmani/web-quality-skills и Codex plugin marketplace; команды не запускались.`
- **Проверка ссылки:** ok
- **Примечание:** SKILL.md, README, LICENSE и Codex setup были открыты/проверены. Для NOVA особенно полезны измерение до/после и оговорка не называть статические гипотезы измеренными регрессиями.

### websocket-engineer

- **Категории:** Real-time Messaging
- **Репозиторий:** https://github.com/jeffallan/claude-skills
- **SKILL.md:** https://raw.githubusercontent.com/jeffallan/claude-skills/main/skills/websocket-engineer/SKILL.md
- **Назначение:** Проектирование WebSocket/Socket.IO систем: auth handshake, rooms/namespaces, acknowledgments, Redis adapter/pub-sub, sticky sessions, heartbeat, reconnection/backoff, presence, queueing during disconnect, limits и monitoring.
- **Совместимость с NOVA:** Прямо совместим с NestJS + Node.js + Socket.IO/WebSocket + Redis в NOVA; примеры используют socket.io, @socket.io/redis-adapter, redis и JWT. Паттерны client queue/reconnect применимы к web и могут быть адаптированы к Android Socket.IO-клиенту.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/jeffallan/claude-skills/main/LICENSE. Исходное описание: MIT; copyright holder: not named in LICENSE beyond Copyright (c) 2025; repository metadata identifies Jeffallan/author and Synergetic Solutions.
- **Последнее обновление:** 2026-10-30T18:00:19Z (Atom: https://github.com/Jeffallan/claude-skills/commits/main.atom)
- **Зависимости:** Примеры/рекомендации используют Node.js, Socket.IO, `@socket.io/redis-adapter`, `redis`, `jsonwebtoken`; для локальной проверки упомянут `npx wscat`. Для production также нужны Redis и sticky-session capable load balancer.
- **Безопасность:** SKILL.md требует auth middleware, JWT validation, CORS, rate limiting и cleanup; предупреждает не хранить большой state в памяти. Содержит `npx wscat` validation command, но ничего не запускалось. В репозитории есть scripts/build/migrate/test и site/scripts, они не запускались. Код-пример обращается к Redis и env secret, но skill не просит токены автоматически.
- **Установка для Codex:** Codex не документирован; вручную: `git clone https://github.com/jeffallan/claude-skills ~/.codex/skills/websocket-engineer`.
- **Проверка ссылки:** ok
- **Примечание:** Проверены raw SKILL.md, raw LICENSE и Atom. Критически релевантен для Socket.IO delivery, Redis horizontal scale и offline reconnect; при внедрении нужно дополнить серверную модель durable message IDs/idempotency и cursor-based sync.

### android-testing

- **Категории:** Testing and QA
- **Репозиторий:** https://github.com/new-silvermoon/awesome-android-agent-skills
- **SKILL.md:** https://raw.githubusercontent.com/new-silvermoon/awesome-android-agent-skills/main/.github/skills/testing_and_automation/android-testing/SKILL.md
- **Назначение:** Стратегия Android testing: unit tests, Hilt integration tests, Room/Retrofit с MockWebServer и Compose screenshot tests через Roborazzi; включает Gradle commands и примеры JUnit/Compose/Hilt.
- **Совместимость с NOVA:** Прямо применим к нативному Kotlin + Jetpack Compose + Gradle APK NOVA; не зависит от Expo/React Native/Flutter.
- **Лицензия:** Apache-2.0; проверено по https://raw.githubusercontent.com/new-silvermoon/awesome-android-agent-skills/main/LICENSE. Исходное описание: Apache-2.0; copyright holder в LICENSE не указан/не виден (подтверждено https://raw.githubusercontent.com/new-silvermoon/awesome-android-agent-skills/main/LICENSE).
- **Последнее обновление:** 2026-07-27T21:51:10Z (api.github.com/repos/new-silvermoon/awesome-android-agent-skills, pushed_at)
- **Зависимости:** Gradle/Android test toolchain; JUnit 4.13.2; kotlinx-coroutines-test; AndroidX Test JUnit; Espresso; Compose ui-test-junit4; Hilt Android testing; Robolectric/Roborazzi; optional MockWebServer. Версии части зависимостей берутся из project version catalog.
- **Безопасность:** SKILL.md в основном содержит Kotlin/Gradle snippets и локальные тестовые команды ./gradlew; обращения к сети или токенам не заявлены. README предлагает копировать .github/skills и Agent.md; scripts/ и curl|bash для этого skill не заявлены. Никакие Gradle/install-команды не запускались.
- **Установка для Codex:** Codex не документирован; вручную: git clone https://github.com/new-silvermoon/awesome-android-agent-skills.git ~/.codex/skills/awesome-android-agent-skills
- **Проверка ссылки:** ok
- **Примечание:** Raw SKILL.md реально открыт, LICENSE проверен. Покрывает именно Compose UI/screenshot, JVM unit и Hilt integration surface; для NOVA Android-клиента это критичное дополнение к web/backend QA.

### nestjs-testing

- **Категории:** Testing and QA
- **Репозиторий:** https://github.com/HoangNguyen0403/agent-skills-standard
- **SKILL.md:** https://raw.githubusercontent.com/HoangNguyen0403/agent-skills-standard/develop/skills/nestjs/nestjs-testing/SKILL.md
- **Назначение:** NestJS unit/E2E testing с Jest, Test.createTestingModule, typed mocks, Supertest, real test DB, cleanup, authorization/security tests и contract-compliance assertions.
- **Совместимость с NOVA:** Прямо совместим с NOVA backend NestJS + Node.js + PostgreSQL; особенно полезен для OTP auth, private messages, guards/tenant authorization и API E2E. Socket.IO contract coverage потребует дополнения отдельными тестами.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/HoangNguyen0403/agent-skills-standard/develop/LICENSE. Исходное описание: MIT; copyright holder Hoang Nguyen (подтверждено https://raw.githubusercontent.com/HoangNguyen0403/agent-skills-standard/main/LICENSE).
- **Последнее обновление:** 2026-11-15T09:40:40Z (api.github.com/repos/HoangNguyen0403/agent-skills-standard, pushed_at)
- **Зависимости:** Node.js 20+ для root tooling; Jest; Nest testing utilities; Supertest для HTTP E2E; PostgreSQL/реальная test DB, часто Docker; TypeScript; npm/npx или ags CLI. Сетевые/DB зависимости нужны при integration/E2E запуске.
- **Безопасность:** SKILL.md требует реальных guards для security/authorization, не допускает bypass в таких тестах, требует real DB и cleanup; это снижает риск ложноположительных auth тестов. README документирует npm install -g agent-skills-standard и npx/ags sync, а также optional MCP; команды не запускались. Токены явно не запрашиваются, но test identities/OTP secrets должны быть synthetic.
- **Установка для Codex:** `npm install -g agent-skills-standard@latest && ags init && ags sync (README явно указывает OpenAI Codex как поддерживаемый агент; команда синхронизирует native configuration).`
- **Проверка ссылки:** ok
- **Примечание:** Raw SKILL.md, MIT LICENSE и README installation path подтверждены. Содержит contract-compliance/error-mapping правила и real DB E2E, поэтому закрывает backend QA лучше общего Jest cheat-sheet; дополнительно согласуется с PostgreSQL и auth критичными путями NOVA.

### nextjs-shadcn

- **Категории:** Web Frontend
- **Репозиторий:** https://github.com/fusengine/agents
- **SKILL.md:** https://raw.githubusercontent.com/fusengine/agents/main/plugins/nextjs-expert/skills/nextjs-shadcn/SKILL.md
- **Назначение:** Практика построения компонентов в Next.js App Router с shadcn/ui, Tailwind CSS v4 и доступными примитивами Base UI, Radix UI или React Aria; охватывает формы, overlays, таблицы, навигацию и MCP registry.
- **Совместимость с NOVA:** Прямое соответствие web-стеку NOVA: Next.js App Router, React 19, TypeScript, Tailwind и shadcn/ui. SKILL.md заявляет Next.js 16, Tailwind CSS 4 и shadcn CLI 4.23.0; требует учитывать фактическую версию проекта и components.json.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/fusengine/agents/main/LICENSE. Исходное описание: MIT; copyright holder: Fusengine Sàrl (подтверждено https://raw.githubusercontent.com/fusengine/agents/main/LICENSE).
- **Последнее обновление:** 2026-11-15T10:17:08Z (GitHub API pushed_at; default branch main)
- **Зависимости:** Next.js 16, React 19, Tailwind CSS 4, shadcn CLI 4.23.0; в зависимости от базы — @base-ui/react, radix-ui или React Aria; TanStack Form, cn и Lucide icons упомянуты в SKILL.md. Для registry-интеграции — shadcn MCP tools.
- **Безопасность:** В SKILL.md есть install-команды bunx --bun shadcn@latest add и bunx --bun shadcn@latest mcp init --client claude; они обращаются к сети и изменяют проект при запуске, но не запускались. Также предписан MCP registry. curl|bash, запросы токенов и чтение секретов в SKILL.md не обнаружены. В репозитории есть другие scripts/, но они не являются частью данного skill; не запускались.
- **Установка для Codex:** Codex явно не документирован для этого репозитория/skill; вручную: git clone https://github.com/Fusengine/claude-plugins.git ~/.codex/skills/nextjs-shadcn. Примечание: SKILL.md документирует bunx-команды shadcn, а не Codex-установку.
- **Проверка ссылки:** ok
- **Примечание:** SKILL.md и LICENSE реально открыты через raw.githubusercontent.com. Репозиторный URL в GitHub нормализован к Fusengine/claude-plugins по API; raw-файлы находятся в основном репозитории fusengine/agents. Не запускать обязательный workflow с тремя агентами автоматически без подтверждения среды NOVA.


## Рекомендуемые навыки (33)

### mcp-server-builder

- **Категории:** AI Agent Engineering
- **Репозиторий:** https://github.com/alirezarezvani/claude-skills
- **SKILL.md:** https://raw.githubusercontent.com/alirezarezvani/claude-skills/main/engineering/skills/mcp-server-builder/SKILL.md
- **Назначение:** Создание MCP-серверов из OpenAPI-контрактов для Python или TypeScript, генерация tool manifest/scaffold, проверка схем, naming, auth strategy и backward compatibility.
- **Совместимость с NOVA:** Прямо совместим с NestJS/Node.js/TypeScript, OpenAPI и GitHub Actions NOVA; может оборачивать API NOVA и внешние сервисы для AI-агентов. Для мобильного APK применим косвенно через backend API.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/alirezarezvani/claude-skills/main/LICENSE. Исходное описание: MIT; copyright holder: Copyright (c) 2025 Alireza Rezvani (LICENSE в корне репозитория).
- **Последнее обновление:** 2026-11-12T10:35:06Z (первый updated в https://github.com/alirezarezvani/claude-skills/commits/main.atom)
- **Зависимости:** Python 3 для scripts/openapi_to_mcp.py и scripts/mcp_validator.py; OpenAPI JSON/YAML contract; Python или TypeScript MCP runtime/SDK выбирается проектом. Пакеты MCP SDK в SKILL.md не перечислены.
- **Безопасность:** В SKILL.md явно упомянуты scripts/openapi_to_mcp.py и scripts/mcp_validator.py; команды python3 запускают локальную генерацию/валидацию и не запускались. Требует держать secrets в env vars, применять outbound host allowlists и не помещать секреты в tool schemas. MCP runtime может обращаться к внешним API, поэтому auth/token handling должен быть отдельно проверен. curl|bash не заявлен.
- **Установка для Codex:** Репозиторий README документирует: npx skills add alirezarezvani/claude-skills. Это installer-команда, не запускалась.
- **Проверка ссылки:** ok
- **Примечание:** Закрывает критичную область MCP для TypeScript/NestJS и связывает API docs/OpenAPI с agent tools. Перед использованием следует отдельно проверить сгенерированные wrappers и auth boundaries.

### prompt-engineer

- **Категории:** AI Agent Engineering
- **Репозиторий:** https://github.com/Jeffallan/claude-skills
- **SKILL.md:** https://raw.githubusercontent.com/Jeffallan/claude-skills/main/skills/prompt-engineer/SKILL.md
- **Назначение:** Проектирование, рефакторинг и оценка LLM-промптов, structured outputs, JSON/function-calling schemas, guardrails, few-shot и prompt evaluation; подходит для OTP-потоков, личных сообщений и agent-функций NOVA.
- **Совместимость с NOVA:** Совместим с NestJS/Node.js backend и любым LLM API, который использует NOVA; не привязан к конкретному мобильному или web-фреймворку. Полезен для TypeScript-схем и CI eval-наборов.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/jeffallan/claude-skills/main/LICENSE. Исходное описание: MIT; copyright holder: Copyright (c) 2025 (в LICENSE holder не назван отдельно; репозиторий и SKILL.md атрибутируют Jeffallan/ Synergetic Solutions).
- **Последнее обновление:** 2026-10-30T18:00:19Z (первый updated в https://github.com/Jeffallan/claude-skills/commits/main.atom)
- **Зависимости:** Не заявлены для самого skill; рекомендуются тестовые наборы, метрики качества, model/provider configuration и schema validation. Пакеты/CLI не указаны.
- **Безопасность:** scripts/ и install-команды в проверенном SKILL.md не заявлены. Есть рекомендация не помещать sensitive data в prompts/examples, учитывать prompt injection defense и model-specific limitations. Сетевые обращения и запросы токенов не описаны; фактическая интеграция с LLM потребует внешнего API и секретов, но skill их не запрашивает.
- **Установка для Codex:** Codex не документирован в проверенном SKILL.md; вручную: git clone https://github.com/Jeffallan/claude-skills.git ~/.codex/skills/prompt-engineer
- **Проверка ссылки:** ok
- **Примечание:** Критично для проектирования и регрессионной проверки промптов, structured output и guardrails для backend NOVA. Проверенный SKILL.md содержит лишь ссылочные reference-файлы, но сам файл доступен и валиден.

### nestjs-features-performance

- **Категории:** API Engineering
- **Репозиторий:** https://github.com/amirtaherkhani/nestjs-skills
- **SKILL.md:** https://raw.githubusercontent.com/amirtaherkhani/nestjs-skills/main/skills/nestjs-features-performance/SKILL.md
- **Назначение:** NestJS lifecycle, API/error/security contracts, pipes, guards, interceptors, exception filters, DTO/validation, Problem Details, HTTP/WebSocket mapping, reliability и performance.
- **Совместимость с NOVA:** Прямо закрывает NestJS REST/OpenAPI/API error handling для NOVA и совместим с Socket.IO/WebSocket, Redis scaling, PostgreSQL и CI/CD; рекомендует lifecycle-appropriate Nest primitives и измерение перед оптимизацией.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/amirtaherkhani/nestjs-skills/main/LICENSE. Исходное описание: MIT; copyright holder: amirtaherkhani (raw LICENSE: Copyright (c) 2026 amirtaherkhani).
- **Последнее обновление:** 2026-11-14T06:39:09Z (первый updated в https://github.com/amirtaherkhani/nestjs-skills/commits/main.atom; API pushed_at: 2026-11-14T06:39:23Z)
- **Зависимости:** Не заявлены конкретные runtime-пакеты; skill ссылается на NestJS primitives и требует проверять версии библиотек/официальную документацию. В репозитории есть scripts/ и npm-команды для validation/test, но они не запускались.
- **Безопасность:** SKILL.md явно требует input validation, auth/authz, безопасное отображение ошибок, отсутствие sensitive data в публичных ответах, deadlines/retries/idempotency и graceful shutdown. Есть scripts/ и документированные npm install/npm test в репозитории; ничего не запускалось. curl|bash и запросы токенов не заявлены; предполагаются чтение файлов проекта и штатные проверки при явном запуске.
- **Установка для Codex:** Документировано README: npx skills add amirtaherkhani/nestjs-skills --skill nestjs-features-performance --agent codex; также поддерживается --global.
- **Проверка ссылки:** ok
- **Примечание:** Самое прямое покрытие API Engineering: DTO, validation, errors, HTTP/GraphQL/RPC/WebSocket boundaries, pagination/idempotency и API design reference routing.

### senior-backend-dev

- **Категории:** API Engineering
- **Репозиторий:** https://github.com/codewithowais/senior-backend-dev
- **SKILL.md:** https://raw.githubusercontent.com/codewithowais/senior-backend-dev/master/SKILL.md
- **Назначение:** Широкий backend/API skill для production REST/GraphQL/gRPC: resource-oriented endpoints, HTTP semantics, validation, consistent errors, pagination, idempotency, OpenAPI/Swagger и code review.
- **Совместимость с NOVA:** Совместим с Node.js/TypeScript и NestJS; README отдельно перечисляет NestJS, REST, OpenAPI/Swagger, middleware, validation и tests. Дополнительно полезен для PostgreSQL/Redis, но поддерживает много нерелевантных стеков, поэтому не является единственным NOVA-specific skill.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/codewithowais/senior-backend-dev/master/LICENSE. Исходное описание: MIT; copyright holder: senior-backend-dev contributors (raw LICENSE: Copyright (c) 2026 senior-backend-dev contributors).
- **Последнее обновление:** 2026-02-10T15:40:03Z (первый updated в https://github.com/codewithowais/senior-backend-dev/commits/master.atom; API pushed_at: 2026-02-10T15:40:05Z)
- **Зависимости:** Не заявлены runtime-пакеты для использования skill; репозиторий содержит references/, templates/ и evals/. README документирует ручной git clone/cp для Claude, но Codex-инструкции нет.
- **Безопасность:** SKILL.md содержит security checklist: validation, parameterized queries, auth/authz, secrets вне исходников, restrictive CORS, rate limiting, request limits, отсутствие PII в логах и HTTPS. В репозитории нет заявленного install script или curl|bash; присутствует evals/ как документация/тестовые материалы. Запросы токенов не заявлены; команды не запускались.
- **Установка для Codex:** Codex не документирован; вручную: git clone https://github.com/codewithowais/senior-backend-dev.git ~/.codex/skills/senior-backend-dev
- **Проверка ссылки:** ok
- **Примечание:** Полезное API review/design дополнение для REST/OpenAPI и machine-readable errors, но broad multi-stack scope снижает NOVA-specific приоритет. README документирует только Claude.ai/Claude Code/API установки; manual Codex path указан по правилу отчёта.

### accessibility-lead

- **Категории:** Accessibility
- **Репозиторий:** https://github.com/Community-Access/accessibility-agents
- **SKILL.md:** https://raw.githubusercontent.com/Community-Access/accessibility-agents/main/skills/accessibility-lead/SKILL.md
- **Назначение:** Роутер accessibility review для web UI: классифицирует изменения, dispatch-ит specialist skills, объединяет findings и выносит ship/no-ship verdict; явно эскалирует Android на mobile-accessibility.
- **Совместимость с NOVA:** Высокая для Next.js/React/TSX/CSS; полезен как orchestrator для web accessibility процесса NOVA и умеет направлять Android/Compose задачи к mobile specialist. Не заменяет конкретный Android checklist.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/Community-Access/accessibility-agents/main/LICENSE. Исходное описание: MIT; copyright holder: Taylor Arndt (видно в LICENSE).
- **Последнее обновление:** 2026-11-07T17:33:17Z (первый updated в https://github.com/Community-Access/accessibility-agents/commits/main.atom)
- **Зависимости:** Node.js/npm для setup; пакетный MCP server; optional Playwright и @axe-core/playwright, pdf-lib, veraPDF CLI; optional GLOW network service для пяти GLOW tools. Plugin bundle может запускаться без npm install.
- **Безопасность:** В репозитории обнаружены scripts/, включая scripts/install.mjs. README документирует npm install, npm run setup, optional npm install --prefix mcp-server и npx playwright install chromium; эти команды не запускались. Skills/scanners работают локально, но web scanners загружают заданные URL; GLOW tools отправляют файлы/запросы на https://letitglow.app/mcp. README документирует Codex plugin commands, но токены не запрашиваются; hooks и MCP могут читать/писать локальные skill/history файлы.
- **Установка для Codex:** Документированная установка: codex plugin marketplace add Community-Access/accessibility-agents && codex plugin add accessibility-agents@community-access. README отмечает, что Codex получает skills и MCP server, но не edit gate; для gate нужен npm run setup.
- **Проверка ссылки:** ok
- **Примечание:** Прямой raw SKILL.md, MIT LICENSE и Atom проверены через curl; README проверен через fetch. Это полноценный skills-пакет с собственными SKILL.md, не awesome-список. Для NOVA особенно ценны structured findings, focus/keyboard/contrast routing и явная граница Android escalation.

### wcag-audit-patterns

- **Категории:** Accessibility
- **Репозиторий:** https://github.com/wshobson/agents
- **SKILL.md:** https://raw.githubusercontent.com/wshobson/agents/main/plugins/accessibility-compliance/skills/wcag-audit-patterns/SKILL.md
- **Назначение:** WCAG 2.2 audit patterns для web: POUR, conformance A/AA/AAA, keyboard access, form labels, alt text, focus outlines, contrast, skip links, landmarks, headings и manual-plus-automated verification.
- **Совместимость с NOVA:** Высокая для Next.js/React/TypeScript web NOVA; покрывает keyboard/focus, screen readers через semantic HTML/ARIA guidance и contrast. Не является Android-specific.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/wshobson/agents/main/LICENSE. Исходное описание: MIT; copyright holder: Seth Hobson (видно в LICENSE).
- **Последнее обновление:** 2026-11-08T13:14:13Z (первый updated в https://github.com/wshobson/agents/commits/main.atom)
- **Зависимости:** не заявлены в SKILL.md; дополнительные детали вынесены в references/details.md, но для базового skill install/runtime не указаны.
- **Безопасность:** scripts/ и install-файлы в дереве не обнаружены. SKILL.md не содержит установочных команд, shell/curl|bash, доступа к файлам или запросов токенов; рекомендует сочетать автоматические и ручные проверки. Ничего не запускалось.
- **Установка для Codex:** Codex не документирован; вручную: git clone https://github.com/wshobson/agents ~/.codex/skills/wshobson-agents и использовать plugins/accessibility-compliance/skills/wcag-audit-patterns/.
- **Проверка ссылки:** ok
- **Примечание:** Прямой raw SKILL.md, MIT LICENSE и Atom проверены через curl. Хорошо дополняет Android skill web-частью NOVA, особенно React keyboard/focus, contrast и screen-reader semantics.

### compose-state-and-effects

- **Категории:** Android Engineering
- **Репозиторий:** https://github.com/chrisbanes/skills
- **SKILL.md:** https://raw.githubusercontent.com/chrisbanes/skills/main/skills/compose-state-and-effects/SKILL.md
- **Назначение:** Практический skill для владения состоянием Compose, state hoisting, screen state holders, LaunchedEffect/DisposableEffect/SideEffect, Flow collection, navigation, snackbar, analytics и focus.
- **Совместимость с NOVA:** Совместим с нативным Kotlin + Jetpack Compose; полезен для OTP-авторизации, chat UI и lifecycle-aware Flow. Не требует Expo/React Native/Flutter.
- **Лицензия:** Apache-2.0; проверено по https://raw.githubusercontent.com/chrisbanes/skills/main/LICENSE. Исходное описание: Apache-2.0; в LICENSE виден стандартный Apache-текст, отдельный copyright holder в проверенном начале файла не указан.
- **Последнее обновление:** 2026-11-15T11:43:10Z (первый <updated> из https://github.com/chrisbanes/skills/commits/main.atom)
- **Зависимости:** Kotlin, Jetpack Compose runtime/UI, Android lifecycle-aware Flow APIs по контексту skill; отдельные CLI/пакеты не заявлены.
- **Безопасность:** В SKILL.md нет scripts/, install-команд, curl|bash или запросов токенов. Skill требует чтения исходников и локальных references; сетевой доступ не обязателен.
- **Установка для Codex:** README документирует: `codex plugin marketplace add chrisbanes/skills --ref main` затем `codex plugin add chrisbanes-skills@chrisbanes-skills`.
- **Проверка ссылки:** ok
- **Примечание:** В репозитории есть собственный .codex-plugin и README с Codex-инструкцией. Это community skill, но авторитетен для Compose-практик и содержит ссылки на специализированные соседние skills.

### database-schema-design

- **Категории:** Database Engineering
- **Репозиторий:** https://github.com/timwukp/agent-skills-best-practice
- **SKILL.md:** https://raw.githubusercontent.com/timwukp/agent-skills-best-practice/main/skills/skills/database-schema-design/SKILL.md
- **Назначение:** Проектирование нормализованных SQL-схем, связей, индексов и миграций; даёт примеры PostgreSQL, raw SQL/Flyway, Prisma и Alembic, включая partial/composite/GIN индексы, FK, TIMESTAMPTZ, rollback и updated_at.
- **Совместимость с NOVA:** Прямо применим к PostgreSQL-схеме NOVA и миграциям backend; raw SQL/Flyway-подход переносим в NestJS/Gradle-independent CI. Prisma/Alembic приведены как альтернативные форматы, не обязательные зависимости.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/timwukp/agent-skills-best-practice/main/LICENSE. Исходное описание: MIT; copyright holder: timwukp (LICENSE: Copyright (c) 2026 timwukp).
- **Последнее обновление:** 2026-09-16T07:06:13Z (Atom: https://github.com/timwukp/agent-skills-best-practice/commits/main.atom)
- **Зависимости:** Не заявлены как обязательные; skill перечисляет raw SQL, Flyway, Liquibase, Prisma и Alembic как поддерживаемые форматы/инструменты.
- **Безопасность:** SKILL.md не содержит install-команд, curl|bash, запросов токенов или сетевых действий; только SQL/схемные примеры. В репозитории есть корневой install.sh и многочисленные scripts/ для других skills, они не запускались и к этому skill не заявлены.
- **Установка для Codex:** Codex не документирован; вручную: `git clone https://github.com/timwukp/agent-skills-best-practice ~/.codex/skills/database-schema-design`.
- **Проверка ссылки:** ok
- **Примечание:** Проверены raw SKILL.md, raw LICENSE и Atom. Полезен как конкретный schema/migration/indexing playbook, но менее специализирован на production PostgreSQL guardrails, чем Microsoft skill.

### redis-core

- **Категории:** Database Engineering
- **Репозиторий:** https://github.com/redis/agent-skills
- **SKILL.md:** https://raw.githubusercontent.com/redis/agent-skills/main/skills/redis-core/SKILL.md
- **Назначение:** Выбор Redis data structures по access pattern (Hash, Set, Sorted Set, Stream и др.) и единообразное именование ключей; покрывает cache/session state, counters, recent-items и persistent fan-out/event-log сценарии.
- **Совместимость с NOVA:** Совместим с Node.js/NestJS и Redis-слоем NOVA; Streams полезны для durable messaging/outbox-like fan-out, Hash/Set/Sorted Set — для presence, membership и counters. Это guidance, не клиентская библиотека.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/redis/agent-skills/main/LICENSE. Исходное описание: MIT; copyright holder: Redis, Inc. (LICENSE: Copyright (c) 2026 Redis, Inc.).
- **Последнее обновление:** 2026-11-05T15:01:14Z (Atom: https://github.com/redis/agent-skills/commits/main.atom)
- **Зависимости:** Не заявлены для самого skill; для практического применения нужен Redis и клиент приложения, но конкретный Node-пакет/версия не указаны.
- **Безопасность:** SKILL.md не содержит install-команд, curl|bash, сетевых вызовов или запросов токенов; есть только примеры команд/ключей. В репозитории присутствуют scripts/ для синхронизации и валидации plugin-копий, они не запускались.
- **Установка для Codex:** README документирует Agent Skills CLI: `npx skills add redis/agent-skills`; для Codex также документирован plugin package в `plugins/redis-development/` с `.codex-plugin/plugin.json`, но отдельная команда `codex add` не указана.
- **Проверка ссылки:** ok
- **Примечание:** Проверены raw SKILL.md, raw LICENSE и Atom. Выбран именно redis-core; redis/agent-skills — официальный Redis-набор Agent Skills. Redis Streams особенно релевантны offline/durable delivery, но idempotency semantics нужно проектировать отдельно.

### Platform Design Skills — Android

- **Категории:** Design Systems
- **Репозиторий:** https://github.com/ehmo/platform-design-skills
- **SKILL.md:** https://raw.githubusercontent.com/ehmo/platform-design-skills/main/skills/android/SKILL.md
- **Назначение:** Android-specific Material Design 3 and WCAG-oriented rules for Material You, dynamic color, navigation, components, accessibility and platform behavior; part of a broader cross-platform pack.
- **Совместимость с NOVA:** Compatible with native Android Kotlin and Jetpack Compose; the README explicitly says the Android skill applies to Compose or XML. Use only `skills/android/SKILL.md` for NOVA and disregard iOS/web/platform files.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/ehmo/platform-design-skills/main/LICENSE. Исходное описание: MIT; LICENSE shows copyright (c) 2026 without a named holder.
- **Последнее обновление:** 2026-03-19T05:13:29Z (first updated entry in https://github.com/ehmo/platform-design-skills/commits/main.atom; API pushed_at 2026-03-19T05:13:32Z).
- **Зависимости:** Не заявлены как runtime dependencies. README cites Material Design 3, WCAG 2.2 and supporting HCI references; installation uses the skills CLI (`npx skills add`).
- **Безопасность:** No scripts/ or install script was found in the repository tree. README documents `npx skills add ehmo/platform-design-skills`, which accesses the network and writes skill files; not executed. The skill is documentation/checklist content and does not request tokens. It may instruct an agent to inspect code or a target, so file/network access depends on the host agent.
- **Установка для Codex:** Documented by the repository: `npx skills add ehmo/platform-design-skills`.
- **Проверка ссылки:** ok
- **Примечание:** Useful complementary Android/WCAG review layer, but broader and partly redundant with the dedicated Material 3 skill. SKILL.md, README, LICENSE and Atom date were fetched successfully.

### docker-expert

- **Категории:** DevOps and CI/CD
- **Репозиторий:** https://github.com/sickn33/agentic-awesome-skills
- **SKILL.md:** https://raw.githubusercontent.com/sickn33/agentic-awesome-skills/main/skills/docker-expert/SKILL.md
- **Назначение:** Экспертная проверка и проектирование Docker: multi-stage builds, .dockerignore, non-root, secrets, Compose networks/healthchecks, resource limits, image optimization, BuildKit cache, multi-arch и production hardening.
- **Совместимость с NOVA:** Высокая для NestJS/Node.js, PostgreSQL и Redis в Docker/Compose; подходит как контейнерный слой CI/CD. Сам skill отсылает GitHub Actions CI/CD к отдельному skill и не покрывает Android Gradle deployment напрямую.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/sickn33/agentic-awesome-skills/main/LICENSE. Исходное описание: MIT; copyright holder: Antigravity User (видно в LICENSE).
- **Последнее обновление:** 2026-11-12T18:58:46Z (первый updated в https://github.com/sickn33/agentic-awesome-skills/commits/main.atom)
- **Зависимости:** Docker/BuildKit/buildx, Docker Compose; Node.js/npm в примерах; PostgreSQL image; опционально Docker Scout и multi-architecture registry. Не устанавливались.
- **Безопасность:** В репозитории обнаружены scripts/ (activate/validate shell scripts). SKILL.md содержит диагностические docker, find, build, run, exec и compose-команды, работу с локальными файлами и Docker secrets; явно предупреждает о side effects и требует авторизации перед build/runtime. Есть сетевой push для multi-arch, но curl|bash и запросы токенов не документированы. Команды не запускались.
- **Установка для Codex:** Codex не документирован в проверенных материалах; вручную: git clone https://github.com/sickn33/agentic-awesome-skills ~/.codex/skills/agentic-awesome-skills и использовать skills/docker-expert/.
- **Проверка ссылки:** ok
- **Примечание:** Это самостоятельный SKILL.md, не только awesome-список. Raw skill, MIT LICENSE и Atom обновления проверены через curl. Для NOVA закрывает контейнеризацию NestJS/Next.js, PostgreSQL/Redis и runtime security; GitHub Actions следует дополнять deployment-patterns.

### architecture-designer

- **Категории:** Documentation
- **Репозиторий:** https://github.com/Jeffallan/claude-skills
- **SKILL.md:** https://raw.githubusercontent.com/Jeffallan/claude-skills/main/skills/architecture-designer/SKILL.md
- **Назначение:** Высокоуровневая архитектура, ADR, анализ trade-offs, scalability planning, component interactions и Mermaid-диаграммы.
- **Совместимость с NOVA:** Прямо применим к архитектуре NOVA: native Android/Kotlin, Next.js/React, NestJS, PostgreSQL, Redis, Socket.IO/WebSocket, GitHub Actions и OTP. Skill не навязывает конкретный runtime.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/jeffallan/claude-skills/main/LICENSE. Исходное описание: MIT; copyright holder: Copyright (c) 2025 (имя holder в LICENSE не указано; SKILL.md атрибутирует Jeffallan/Synergetic Solutions).
- **Последнее обновление:** 2026-10-30T18:00:19Z (первый updated в https://github.com/Jeffallan/claude-skills/commits/main.atom)
- **Зависимости:** Mermaid для диаграмм указан как предпочтительный формат; reference-файлы architecture-patterns.md, adr-template.md, system-design.md, database-selection.md и nfr-checklist.md. CLI/пакеты не заявлены.
- **Безопасность:** scripts/, install-команды, curl|bash и запросы токенов в проверенном SKILL.md не заявлены. Рекомендует учитывать security considerations и failure modes, но это guidance, не автоматический security scanner. Работает с проектными документами и архитектурным контекстом.
- **Установка для Codex:** Codex не документирован в проверенном SKILL.md; вручную: git clone https://github.com/Jeffallan/claude-skills.git ~/.codex/skills/architecture-designer
- **Проверка ссылки:** ok
- **Примечание:** Критично для ADR и диаграмм NOVA, включая границы Android/web/backend и realtime/Redis. Один из наиболее прямых matches для Documentation-категории.

### i18n-localization

- **Категории:** Internationalization
- **Репозиторий:** https://github.com/davila7/claude-code-templates
- **SKILL.md:** https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/skills/development/i18n-localization/SKILL.md
- **Назначение:** Practical i18n/l10n patterns for hardcoded-string detection, translation keys and namespaces, locale files, pluralization, Intl date/number formatting, fallback languages, RTL, and CSS logical properties. Useful as a lightweight review checklist for Next.js/React and locale-aware UI.
- **Совместимость с NOVA:** Direct examples cover React/react-i18next and Next.js/next-intl; principles also apply to Compose resource strings. It is not a runtime library and does not implement Android resource generation.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/davila7/claude-code-templates/main/LICENSE. Исходное описание: MIT; copyright holder Daniel (San) Ávila (verified from https://raw.githubusercontent.com/davila7/claude-code-templates/main/LICENSE).
- **Последнее обновление:** 2026-11-15T16:23:35Z (first updated in https://github.com/davila7/claude-code-templates/commits/main.atom)
- **Зависимости:** Read, Glob, Grep for the skill's declared allowed tools; examples mention react-i18next, next-intl, Intl APIs, and an optional scripts/i18n_checker.py checker. No mandatory runtime dependency is declared by SKILL.md.
- **Безопасность:** Declared allowed tools are Read, Glob, and Grep. SKILL.md references a Python checker that scans a project for hardcoded strings/missing translations; do not run it during research. No curl|bash, network access, or token request is documented by this skill. Repository contains a broader CLI and unrelated installers, so activate only the individual skill and inspect generated changes.
- **Установка для Codex:** Codex не документирован для этой individual skill; вручную: git clone https://github.com/davila7/claude-code-templates.git ~/.codex/skills/claude-code-templates
- **Проверка ссылки:** ok
- **Примечание:** Useful complementary checklist, but overlaps with the more actionable i18next skill; keep it for RTL/locale-aware UI review rather than installing both as competing i18n workflows.

### i18next-localization

- **Категории:** Internationalization
- **Репозиторий:** https://github.com/i18next/i18next-cli
- **SKILL.md:** https://raw.githubusercontent.com/i18next/i18next-cli/main/skills/i18next-localization/SKILL.md
- **Назначение:** Version-matched i18next localization workflow: detect stack, configure locales, instrument hardcoded strings, extract keys, lint placeholders/plurals, and optionally sync with Locize. Direct fit for the Next.js + React + TypeScript web application and useful for localized auth/error messages.
- **Совместимость с NOVA:** Directly compatible with Next.js/React/TypeScript; SKILL.md explicitly covers i18next, react-i18next, and next-i18next. Android/Kotlin needs a separate Android resource workflow, while the backend can return locale keys or negotiate Accept-Language as documented.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/i18next/i18next-cli/main/LICENSE. Исходное описание: MIT; copyright holder i18next (2025-present) (verified from https://raw.githubusercontent.com/i18next/i18next-cli/main/LICENSE).
- **Последнее обновление:** 2026-11-15T08:38:25Z (first updated in https://github.com/i18next/i18next-cli/commits/main.atom)
- **Зависимости:** Node.js/npm or npx; i18next and the framework binding (react-i18next for React, matching binding for other stacks) must be installed by the project. Optional Locize flow uses locize-cli and optional i18next-locize-backend. No Android runtime dependency is declared.
- **Безопасность:** SKILL.md permits Bash(npx i18next-cli *) and documents commands that rewrite source/config files. Optional Locize sync/download contacts an external service and requires LOCIZE_PROJECTID and LOCIZE_API_KEY only after explicit opt-in; it warns never to put the API key in client code. No curl|bash instruction found. Do not execute commands during research.
- **Установка для Codex:** `npx skills add i18next/i18next-cli (explicitly documented in the repository README as the recommended Agent Skill installation).`
- **Проверка ссылки:** ok
- **Примечание:** Best fit for NOVA web localization. Use its hard stop when another i18n library such as next-intl or Lingui is already installed; choose one translation pipeline rather than silently mixing them.

### internationalization-and-localization

- **Категории:** Internationalization
- **Репозиторий:** https://github.com/arneesh/agent-protocols
- **SKILL.md:** https://raw.githubusercontent.com/arneesh/agent-protocols/master/skills/internationalization-and-localization/SKILL.md
- **Назначение:** Framework-neutral i18n/l10n protocol covering string extraction, stable keys, plural/gender rules, text expansion, RTL, locale-aware dates/numbers/collation, pseudo-localization, fallback behavior, and API locale negotiation. Useful across NOVA web, Android, email, push, and backend error contracts.
- **Совместимость с NOVA:** Highly compatible with a multi-client NOVA architecture because it is process and contract guidance rather than a framework package; complements Next.js, Compose, NestJS, email, and API Accept-Language/key-based response design.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/arneesh/agent-protocols/master/LICENSE. Исходное описание: MIT; copyright holder Arneesh Aima (verified from https://raw.githubusercontent.com/arneesh/agent-protocols/master/LICENSE).
- **Последнее обновление:** 2026-04-16T17:31:06Z (first updated in https://github.com/arneesh/agent-protocols/commits/master.atom)
- **Зависимости:** не заявлены
- **Безопасность:** The checked skill is prose guidance with no install command, token request, network action, or file-writing command. The repository contains unrelated scripts elsewhere; do not run them for this skill. Relevant security benefit is consistent localization of auth/errors and explicit API locale negotiation rather than leaking default-language messages.
- **Установка для Codex:** Codex не документирован; вручную: git clone https://github.com/arneesh/agent-protocols.git ~/.codex/skills/agent-protocols
- **Проверка ссылки:** ok
- **Примечание:** Use as the cross-platform i18n design checklist before selecting concrete libraries. Repository README documents a Claude plugin command, not a Codex-specific command.

### transloadit-media-processing

- **Категории:** Media Processing
- **Репозиторий:** https://github.com/github/awesome-copilot
- **SKILL.md:** https://raw.githubusercontent.com/github/awesome-copilot/main/skills/transloadit-media-processing/SKILL.md
- **Назначение:** Облачные pipeline для видео, аудио, изображений и документов: кодирование HLS/MP4/WebM, thumbnails, resize/crop/watermark, конвертация JPEG/PNG/WebP/AVIF/HEIF, извлечение и транскодирование аудио, OCR и экспорт в хранилища.
- **Совместимость с NOVA:** Совместим с backend NestJS/Node.js и upload/media pipeline NOVA через Transloadit API/MCP; Android и Next.js могут использовать результат через API/URL. Это облачный сервис, а не локальная Kotlin-библиотека.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/github/awesome-copilot/main/LICENSE. Исходное описание: MIT; copyright holder GitHub, Inc. (подтверждено https://raw.githubusercontent.com/github/awesome-copilot/main/LICENSE).
- **Последнее обновление:** 2026-11-14T20:42:30Z (api.github.com/repos/github/awesome-copilot, pushed_at); проверка Atom: 2026-11-13T21:35:59Z
- **Зависимости:** Transloadit account; @transloadit/mcp-server MCP server или @transloadit/node CLI; Node.js/npm через npx; Transloadit API key и secret; сеть; локальные входные media-файлы.
- **Безопасность:** SKILL.md документирует npx -y запуск MCP/CLI, передачу TRANSLOADIT_KEY и TRANSLOADIT_SECRET, отправку файлов в облако и внешние watermark/import URLs; требуется заранее оценить хранение пользовательских медиа и секретов. scripts/ в SKILL.md не заявлены; установочные команды не запускались.
- **Установка для Codex:** Codex не документирован; вручную: git clone https://github.com/github/awesome-copilot.git ~/.codex/skills/awesome-copilot
- **Проверка ссылки:** ok
- **Примечание:** Прямой raw SKILL.md реально открыт и содержит frontmatter/license/compatibility и workflows. Подходит для thumbnails и масштабируемой обработки uploads, но требует внешнего SaaS и credentials; EXIF-операции отдельно не заявлены. README/skill не документируют Codex-specific install.

### Android Compose Design

- **Категории:** Mobile UI/UX
- **Репозиторий:** https://github.com/NI3singh/android-compose-design-skill
- **SKILL.md:** https://raw.githubusercontent.com/NI3singh/android-compose-design-skill/main/SKILL.md
- **Назначение:** Native Android Compose UI/UX guidance focused on distinctive but production-grade Material 3 interfaces, custom themes, color/typography/shape tokens, hierarchy, motion, edge-to-edge, accessibility, dynamic type and approximately 48dp touch targets.
- **Совместимость с NOVA:** Directly compatible with Kotlin + Jetpack Compose + `androidx.compose.material3`; README states a Jetpack Compose/Material 3 Android project. Does not require Expo, React Native or Flutter. Guidance to use bundled/downloadable fonts requires NOVA to separately choose and license a font.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/NI3singh/android-compose-design-skill/main/LICENSE. Исходное описание: MIT; LICENSE literally lists copyright (c) 2026 <YOUR NAME>, an unfilled template holder; this uncertainty is recorded rather than normalized.
- **Последнее обновление:** 2026-06-04T09:44:13Z (first updated entry in https://github.com/NI3singh/android-compose-design-skill/commits/main.atom; API pushed_at 2026-06-04T09:44:39Z).
- **Зависимости:** README states a Jetpack Compose + Material 3 Kotlin project. No skill runtime packages are declared. Optional implementation guidance mentions Android font resources or the downloadable-fonts dependency, but no specific required version is stated.
- **Безопасность:** No scripts/ directory or installer was found in the repository tree. README documents git clone into `.claude/skills` or `~/.claude/skills`; this accesses the network and writes files, but was not run. It notes downloadable fonts as an optional network-backed implementation choice; no token request or curl|bash installer was documented.
- **Установка для Codex:** Codex is not documented; manually: `git clone https://github.com/NI3singh/android-compose-design-skill.git ~/.codex/skills/android-compose-design`. This is an adaptation of the repository's documented clone-to-agent-skills setup, and the repository primarily targets Claude Code/compatible SKILL.md agents.
- **Проверка ссылки:** ok
- **Примечание:** Valuable UX/design-direction complement to the more normative Material 3 skills. Its advice is intentionally opinionated about avoiding generic UI, so retain Material accessibility/contrast constraints and review font licensing before adopting suggestions.

### animate

- **Категории:** Motion Design
- **Репозиторий:** https://github.com/emilkowalski/skills
- **SKILL.md:** https://raw.githubusercontent.com/emilkowalski/skills/main/skills/animate/SKILL.md
- **Назначение:** Строит UI-анимацию с последовательным выбором: нужна ли motion вообще, её цель, инструмент, свойства, curve/duration, interruptibility, exit и reduced-motion/hover gating.
- **Совместимость с NOVA:** Прямо полезен для web-части NOVA (CSS/JS UI animation и React-компоненты). Android/Compose не является прямой целью: README и SKILL.md ориентированы на web-подход, а отдельный animate-expo skill относится к React Native и здесь не выбран.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/emilkowalski/skills/main/LICENSE. Исходное описание: MIT; copyright holder: Emil Kowalski. Проверено по https://raw.githubusercontent.com/emilkowalski/skills/main/LICENSE.
- **Последнее обновление:** 2026-11-15T12:42:50Z (pushed_at из https://api.github.com/repos/emilkowalski/skills; default branch main)
- **Зависимости:** не заявлены; конкретная библиотека выбирается по задаче и существующим токенам codebase.
- **Безопасность:** В выбранном skill не заявлены scripts/, curl|bash, токены или обязательные сетевые вызовы. Репозиторий содержит набор markdown skills; установка через npx skills@latest add требует внешней загрузки и не выполнялась.
- **Установка для Codex:** Репозиторий документирует: npx skills@latest add emilkowalski/skills
- **Проверка ссылки:** ok
- **Примечание:** SKILL.md и LICENSE открыты через raw.githubusercontent.com. Skill особенно ценен для reduced motion, hover gating, interruption и craft-review требований; не является исключённым kylezantos/design-motion-principles.

### motion-design

- **Категории:** Motion Design
- **Репозиторий:** https://github.com/LottieFiles/motion-design-skill
- **SKILL.md:** https://raw.githubusercontent.com/LottieFiles/motion-design-skill/main/skills/motion-design/SKILL.md
- **Назначение:** Применяет motion-принципы к UI-анимациям: эмоциональное намерение, narrative/choreography, timing, easing, property selection, feedback, loading/error/success states, scroll effects и brand motion identity.
- **Совместимость с NOVA:** Implementation-agnostic и применим к web CSS, Motion/Framer Motion, GSAP и Lottie; как принципиальный reference совместим и с Jetpack Compose animations. Для NOVA полезен в web-переходах, чат-состояниях, OTP feedback и согласовании motion между Android и web.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/LottieFiles/motion-design-skill/main/LICENSE. Исходное описание: MIT; copyright holder: LottieFiles. Проверено по https://raw.githubusercontent.com/LottieFiles/motion-design-skill/main/LICENSE.
- **Последнее обновление:** 2026-05-18T11:30:13Z (pushed_at из https://api.github.com/repos/LottieFiles/motion-design-skill; default branch main)
- **Зависимости:** не заявлены; skill специально описан как implementation-agnostic и перечисляет CSS, Framer Motion, GSAP, Lottie и Spring как возможные системы.
- **Безопасность:** В дереве репозитория подтверждены SKILL.md и reference/director-файлы, обязательные scripts/ и install-скрипты не заявлены. Нет curl|bash, токенов или обязательных сетевых обращений в SKILL.md. README документирует npx installation; не запускалась.
- **Установка для Codex:** Репозиторий документирует: npx skills add LottieFiles/motion-design-skill
- **Проверка ссылки:** ok
- **Примечание:** Путь SKILL.md подтверждён raw.githubusercontent.com; README описывает тот же skill как universal motion design skill и поддержку Codex. Не включён ранее проверенный kylezantos/design-motion-principles.

### core-web-vitals

- **Категории:** Performance Engineering
- **Репозиторий:** https://github.com/addyosmani/web-quality-skills
- **SKILL.md:** https://raw.githubusercontent.com/addyosmani/web-quality-skills/main/skills/core-web-vitals/SKILL.md
- **Назначение:** Специализированная диагностика и оптимизация LCP, INP и CLS по CrUX/field данным и browser performance traces, включая LCP resource discovery, TTFB, render blocking и prerender trade-offs.
- **Совместимость с NOVA:** Прямо применим к Next.js/React: рекомендации по SSR/SSG/streaming, discoverable images, resource priority, React rendering и измерению на 75-м перцентиле. Совместим с TypeScript/Tailwind, так как не привязан к конкретному bundler.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/addyosmani/web-quality-skills/main/LICENSE. Исходное описание: MIT; copyright holder: Addy Osmani (подтверждено https://raw.githubusercontent.com/addyosmani/web-quality-skills/main/LICENSE).
- **Последнее обновление:** 2026-08-24T21:07:36Z (GitHub API pushed_at; default branch main)
- **Зависимости:** Опционально CrUX, Chrome DevTools MCP/performance trace, first-party RUM и Lighthouse/PageSpeed workflow; обязательные runtime-пакеты не заявлены.
- **Безопасность:** Нет scripts и install-команд в выбранном SKILL.md; рекомендуемые CrUX/DevTools/field integrations требуют сеть, а RUM может отправлять telemetry в endpoint проекта. curl|bash и запросы токенов не обнаружены; запусков не было.
- **Установка для Codex:** `codex plugin marketplace add addyosmani/web-quality-skills; затем включить/вызвать skill core-web-vitals через Codex plugin. README репозитория также документирует npx skills add addyosmani/web-quality-skills; не запускалось.`
- **Проверка ссылки:** ok
- **Примечание:** Это отдельный SKILL.md из того же проверенного репозитория, не дубликат performance: focus — именно три Web Vitals и причинная диагностика метрик.

### web-performance-optimization

- **Категории:** Performance Engineering
- **Репозиторий:** https://github.com/secondsky/claude-skills
- **SKILL.md:** https://raw.githubusercontent.com/secondsky/claude-skills/main/plugins/web-performance-optimization/skills/web-performance-optimization/SKILL.md
- **Назначение:** Практический checklist и примеры для code splitting, lazy loading, image optimization, service-worker caching, compression и мониторинга LCP/INP/CLS.
- **Совместимость с NOVA:** Совместим как общий performance reference с React/Next.js и TypeScript, но примеры частично ориентированы на react-router и Webpack, поэтому для Next.js App Router нужны адаптация к next/dynamic, Next Image и встроенному bundling.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/secondsky/claude-skills/main/LICENSE. Исходное описание: MIT; copyright holder: Claude Skills Maintainers (подтверждено https://raw.githubusercontent.com/secondsky/claude-skills/main/LICENSE).
- **Последнее обновление:** 2026-10-31T14:17:41Z (GitHub API pushed_at; default branch main); проверка Atom: 2026-09-26T12:15:25Z
- **Зависимости:** Lighthouse/PageSpeed Insights, WebPageTest, Chrome DevTools Performance, Performance API и web-vitals npm package упомянуты как инструменты; дополнительные references упоминают Puppeteer, Webpack compression и Terser. Не все обязательны.
- **Безопасность:** Выбранный SKILL.md содержит примеры fetch('/api/analytics'), PerformanceObserver и service worker caching, то есть код может отправлять telemetry или читать/писать Cache Storage при внедрении. README документирует Codex marketplace и npx skills install (сетевые install-команды), но они не запускались. curl|bash и запросы токенов в выбранном SKILL.md не обнаружены; в репозитории есть scripts/ у других skills, не запускались.
- **Установка для Codex:** `codex plugin marketplace add secondsky/claude-skills; затем выбрать плагин в Codex TUI (/plugins). README также документирует npx skills add secondsky/claude-skills --skill web-performance-optimization --agent codex; команды не запускались.`
- **Проверка ссылки:** ok
- **Примечание:** SKILL.md, README и LICENSE реально открыты через raw.githubusercontent.com. Более generic и менее Next-specific, чем Addy Osmani skills; ценен как компактный implementation checklist, но React Router/Webpack-примеры нельзя копировать в NOVA без адаптации.

### product-design

- **Категории:** Product Design
- **Репозиторий:** https://github.com/mblode/agent-skills
- **SKILL.md:** https://raw.githubusercontent.com/mblode/agent-skills/main/skills/product-design/SKILL.md
- **Назначение:** Проектирует поведение продукта до реализации: выбор контролов и взаимодействий, область действия, последствия, обратимость, восстановление и полный набор достижимых состояний.
- **Совместимость с NOVA:** Применим к NOVA и для нативного Android на Kotlin/Jetpack Compose, и для Next.js/React: это слой продуктовых решений, не завязанный на конкретный UI-фреймворк. Полезен для OTP, личных сообщений, ошибок сети, удаления и состояний загрузки.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/mblode/agent-skills/main/LICENSE.md. Исходное описание: MIT; copyright holder: Matthew Blode. Проверено по https://raw.githubusercontent.com/mblode/agent-skills/main/LICENSE.md.
- **Последнее обновление:** 2026-11-14T06:48:19Z (pushed_at из https://api.github.com/repos/mblode/agent-skills; default branch main)
- **Зависимости:** не заявлены; skill использует собственные reference-файлы репозитория.
- **Безопасность:** В самом skill не заявлены токены, curl|bash или обязательные сетевые вызовы. Репозиторий в целом содержит scripts/ для других skills, но запуск не выполнялся. Документированная установка через npx требует загрузки и выполнения внешнего CLI; не запускалась.
- **Установка для Codex:** Репозиторий документирует: npx skills add mblode/agent-skills -g --agent codex claude-code -y
- **Проверка ссылки:** ok
- **Примечание:** SKILL.md и LICENSE.md открыты через raw.githubusercontent.com. Skill прямо закрывает критичный слой продуктовых решений и хорошо дополняет UI-реализацию NOVA; не является дубликатом исключённых репозиториев. В README также явно перечислен product-design skill.

### ui-design

- **Категории:** Product Design
- **Репозиторий:** https://github.com/mblode/agent-skills
- **SKILL.md:** https://raw.githubusercontent.com/mblode/agent-skills/main/skills/ui-design/SKILL.md
- **Назначение:** Задаёт визуальное направление, дизайн-токены, responsive/dark-mode решения, сборку React/Next UI и аудит визуальных и интерактивных дефектов с доказательствами и ship verdict.
- **Совместимость с NOVA:** Непосредственно совместим с web-частью NOVA на Next.js + React + TypeScript; для Android применим как источник UI/UX правил, но не как нативный Compose-кодогенератор. Полезен для согласования web-дизайн-системы с мобильными экранами.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/mblode/agent-skills/main/LICENSE.md. Исходное описание: MIT; copyright holder: Matthew Blode. Проверено по https://raw.githubusercontent.com/mblode/agent-skills/main/LICENSE.md.
- **Последнее обновление:** 2026-11-14T06:48:19Z (pushed_at из https://api.github.com/repos/mblode/agent-skills; default branch main)
- **Зависимости:** Для заявленной реализации упоминаются React/Next.js и Tailwind; обязательные версии пакетов не заявлены.
- **Безопасность:** В SKILL.md нет запросов токенов и curl|bash. В репозитории есть scripts/ для вспомогательных и eval-сценариев других skills; скрипты не запускались. Работа с локальными файлами/рендером подразумевается режимами аудита, но конкретный обязательный сетевой сервис не заявлен. Установка через npx требует внешней загрузки; не запускалась.
- **Установка для Codex:** Репозиторий документирует: npx skills add mblode/agent-skills -g --agent codex claude-code -y
- **Проверка ссылки:** ok
- **Примечание:** SKILL.md и LICENSE.md открыты через raw.githubusercontent.com. Это отдельный UI-слой того же проверенного repo, не копия исключённых Taste Skill или UI UX Pro Max; product-design и ui-design в README разделены по ответственности.

### ux-writing

- **Категории:** Product Design
- **Репозиторий:** https://github.com/content-designer/ux-writing-skill
- **SKILL.md:** https://raw.githubusercontent.com/content-designer/ux-writing-skill/main/SKILL.md
- **Назначение:** Пишет и редактирует пользовательский микрокопирайт: кнопки, labels, ошибки, уведомления, формы, onboarding, empty/success states, help text; применяет стандарты purposeful, concise, conversational, clear и accessibility-практики.
- **Совместимость с NOVA:** Совместим с Android Compose и Next.js: работает на уровне текстов интерфейса и conversational flows. Особенно полезен для email OTP, ошибок доставки/истечения кода, permission/error сообщений и личных сообщений.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/content-designer/ux-writing-skill/main/LICENSE. Исходное описание: MIT; copyright holder: Christopher Greer. Проверено по https://raw.githubusercontent.com/content-designer/ux-writing-skill/main/LICENSE.
- **Последнее обновление:** 2026-05-26T23:23:35Z (pushed_at из https://api.github.com/repos/content-designer/ux-writing-skill; default branch main)
- **Зависимости:** не заявлены; README указывает поддержку Claude Desktop, Claude Code, Codex CLI/IDE и Cursor, а также skills CLI для установки.
- **Безопасность:** В SKILL.md не заявлены токены, curl|bash или обязательный доступ к сети/файлам. README предлагает npx skills add, что скачивает skill через внешний CLI; команда не запускалась. Figma integration описана как опциональная, без выполнения и без запроса credentials.
- **Установка для Codex:** Репозиторий документирует: npx skills add content-designer/ux-writing-skill
- **Проверка ссылки:** ok
- **Примечание:** SKILL.md и LICENSE открыты через raw.githubusercontent.com. README явно указывает Codex CLI/IDE compatibility и содержит installation command. Skill закрывает критичную область UX writing, которой нет в backend/frontend runtime skills.

### create-prd

- **Категории:** Product Management
- **Репозиторий:** https://github.com/phuryn/pm-skills
- **SKILL.md:** https://raw.githubusercontent.com/phuryn/pm-skills/main/pm-execution/skills/create-prd/SKILL.md
- **Назначение:** Lean, decision-ready PRD: problem/background, objective and measurable key results, market segments, JTBD value propositions, solution, assumptions/open questions, release scope, user stories and engineering handoff context. Explicitly avoids inventing unknown facts and supports review of existing PRDs.
- **Совместимость с NOVA:** Высокая для NOVA: продуктовая практика не привязана к UI-фреймворку; раздел Technology может описывать Kotlin/Jetpack Compose/Gradle, Next.js/React/TypeScript, NestJS/Node.js, PostgreSQL, Socket.IO/WebSocket, Redis и GitHub Actions. Хорошо подходит для OTP-email auth и личных сообщений как функциональных областей.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/phuryn/pm-skills/main/LICENSE. Исходное описание: MIT; copyright holder: Pawel Huryn (подтверждено raw LICENSE).
- **Последнее обновление:** 2026-11-08T22:45:25Z (первый <updated> из https://github.com/phuryn/pm-skills/commits/main.atom; API pushed_at: 2026-11-08T23:10:04Z).
- **Зависимости:** Не заявлены runtime/package dependencies. Skill references other skills in the same marketplace for value proposition and related work, but standalone PRD generation is Markdown/instruction based. Repository README documents Claude Code/Cowork and Codex plugin usage.
- **Безопасность:** В проверенном SKILL.md нет install-скриптов, curl|bash, запросов токенов или обращения к файлам/сети во время выполнения; есть инструкция сохранять результат как Markdown и рекомендация web research при необходимости. Репозиторий не содержит scripts/ по Git tree-проверке. Установка через Codex plugin marketplace требует сетевого доступа и запускается пользователем; не выполнялась.
- **Установка для Codex:** Репозиторий документирует Codex CLI: `codex plugin marketplace add phuryn/pm-skills`, затем `codex plugin add pm-execution@pm-skills` (README также предупреждает, что slash-команды Claude не являются Codex slash-командами).
- **Проверка ссылки:** ok
- **Примечание:** Прямой raw SKILL.md реально открыт и получен. Критически закрывает PRD, user stories, measurable success, scope и release planning для NOVA. Не дублирует launch/analytics skills по основному назначению.

### deliver-prd

- **Категории:** Product Management
- **Репозиторий:** https://github.com/product-on-purpose/pm-skills
- **SKILL.md:** https://raw.githubusercontent.com/product-on-purpose/pm-skills/main/skills/deliver-prd/SKILL.md
- **Назначение:** Comprehensive PRD for engineering handoff: problem, measurable goals, solution, testable functional requirements, scope boundaries, technical considerations, dependencies/risks, milestones, open questions, plus conditional AI evaluation and agent execution contract.
- **Совместимость с NOVA:** Высокая: framework-agnostic и ориентирован на handoff между product/engineering/QA. Хорошо раскладывает NOVA по native Android и web/backend surfaces, API/integration constraints, PostgreSQL, WebSocket and CI/CD; требования можно сделать testable для Kotlin, Next.js и NestJS без диктовки реализации.
- **Лицензия:** Apache-2.0; проверено по https://raw.githubusercontent.com/product-on-purpose/pm-skills/main/LICENSE. Исходное описание: Apache-2.0; copyright holder: Jonathan Prisant (указан в raw LICENSE; SKILL.md также содержит `license: Apache-2.0`).
- **Последнее обновление:** 2026-11-14T08:57:32Z (первый <updated> из https://github.com/product-on-purpose/pm-skills/commits/main.atom; API pushed_at: 2026-11-14T08:57:35Z).
- **Зависимости:** Не заявлены обязательные runtime/package dependencies. Skill references repository-local `references/TEMPLATE.md`, related skills, optional `.claude/pm-skills.local.md`, plugin marketplace and `npx skills` installation paths.
- **Безопасность:** В SKILL.md нет curl|bash и нет запросов токенов. В репозитории подтверждён большой scripts/ каталог с shell/PowerShell/Node validation/build utilities; их не запускал. README предлагает `/plugin marketplace ...`, `npx skills add ...` и clone, что требует сети и может устанавливать/копировать файлы. Project Memory Contract читает/пишет `.claude/pm-skills.local.md` только при наличии и с правилами подтверждения; для NOVA это потенциальная область доступа к файлам.
- **Установка для Codex:** README документирует cross-agent установку: `npx skills add product-on-purpose/pm-skills`; там же указано, что Codex поддерживается через AGENTS.md auto-discovery/native skills. Для plugin-режима README документирует `/plugin marketplace add product-on-purpose/agent-plugins` и `/plugin install pm-skills@product-on-purpose`; команды не запускались.
- **Проверка ссылки:** ok
- **Примечание:** Прямой raw SKILL.md реально открыт и получен. Очень силён для engineering handoff и verification contract, но частично пересекается с create-prd; оставлен как более строгий companion для крупных эпиков и cross-functional delivery.

### launch-plan

- **Категории:** Product Management
- **Репозиторий:** https://github.com/assimovt/productskills
- **SKILL.md:** https://raw.githubusercontent.com/assimovt/productskills/main/skills/launch-plan/SKILL.md
- **Назначение:** Plans launch readiness using silent, soft and big-bang tiers; supplies product/content/distribution/support/measurement checklists, rollback requirements, ownership and post-launch review cadence.
- **Совместимость с NOVA:** Высокая для launch planning NOVA: supports feature flags, staged rollout, monitoring, rollback and analytics. Especially relevant to Android APK/web releases, OTP auth and real-time messaging where soft rollout, support FAQ and WebSocket/latency monitoring reduce risk; it is stack-independent.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/assimovt/productskills/main/LICENSE. Исходное описание: MIT; copyright holder: Tair Asim (подтверждено raw LICENSE репозитория).
- **Последнее обновление:** 2026-02-18T10:37:27Z (первый <updated> из https://github.com/assimovt/productskills/commits/main.atom; API pushed_at: 2026-02-18T10:37:28Z).
- **Зависимости:** Skill itself is Markdown-only; не заявлены runtime/package dependencies. README documents optional `npx skills` CLI, Claude plugin, git clone and copy; launch checklist mentions generic feature flags, monitoring/alerting, analytics, support and content tools without requiring named packages.
- **Безопасность:** SKILL.md не содержит scripts/, curl|bash, file/network access code или token requests. README installation invokes `npx skills add`, plugin marketplace or `git clone`, requiring network and user permissions; commands were not run. Checklist explicitly requires rollback and monitoring but does not itself access production systems.
- **Установка для Codex:** README does not document a dedicated Codex CLI installer; it says Codex can use the Markdown skills as knowledge-base documents. Documented manual route: `git clone https://github.com/assimovt/productskills.git` then add/reference `productskills/skills/launch-plan/SKILL.md` in the Codex knowledge base. Codex-specific automatic installation is not documented.
- **Проверка ссылки:** ok
- **Примечание:** Прямой raw SKILL.md реально открыт и получен. Нишевее PRD/analytics, но закрывает launch planning, staged rollout and rollback — важные operational risks для NOVA.

### metrics-dashboard

- **Категории:** Product Management
- **Репозиторий:** https://github.com/phuryn/pm-skills
- **SKILL.md:** https://raw.githubusercontent.com/phuryn/pm-skills/main/pm-product-discovery/skills/metrics-dashboard/SKILL.md
- **Назначение:** Designs a product analytics dashboard using North Star, input, health and business metrics; defines exact calculations, data sources, visualizations, targets, alert thresholds and review cadence.
- **Совместимость с NOVA:** Высокая: прямо применим к product analytics NOVA. PostgreSQL поддерживается как естественный источник данных; skill рекомендует SQL/dashboard tools, а operational health layer можно связать с NestJS/WebSocket/Redis и GitHub Actions telemetry. Подходит для OTP funnel, activation, messaging engagement, retention, latency/error guardrails.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/phuryn/pm-skills/main/LICENSE. Исходное описание: MIT; copyright holder: Pawel Huryn (подтверждено raw LICENSE репозитория).
- **Последнее обновление:** 2026-11-08T22:45:25Z (первый <updated> из https://github.com/phuryn/pm-skills/commits/main.atom; API pushed_at: 2026-11-08T23:10:04Z).
- **Зависимости:** Не заявлены обязательные runtime/package dependencies. В качестве возможных инструментов skill перечисляет Amplitude, Mixpanel, PostHog, Looker, Metabase, Mode, Datadog и Grafana; это рекомендации, не обязательные зависимости.
- **Безопасность:** SKILL.md не содержит install-команд, scripts/, curl|bash или запросов токенов; описывает только проектирование метрик и alerts. Упоминание analytics/monitoring tools подразумевает возможный сетевой доступ и права к данным при последующей реализации, но skill сам ничего не устанавливает и не запускает.
- **Установка для Codex:** Codex CLI: `codex plugin marketplace add phuryn/pm-skills`, затем `codex plugin add pm-product-discovery@pm-skills` — команда документирована README репозитория.
- **Проверка ссылки:** ok
- **Примечание:** Прямой raw SKILL.md реально открыт и получен. Это наиболее прямое покрытие product analytics в кластере; skill задаёт cadence и alert ownership, что полезно для production NOVA.

### redis-clustering

- **Категории:** Real-time Messaging
- **Репозиторий:** https://github.com/redis/agent-skills
- **SKILL.md:** https://raw.githubusercontent.com/redis/agent-skills/main/skills/redis-clustering/SKILL.md
- **Назначение:** Redis Cluster/replication: hash tags для multi-key операций, предотвращение CROSSSLOT, pipeline/transaction/Lua key placement и read replicas с явным предупреждением об eventual consistency.
- **Совместимость с NOVA:** Совместим с Redis-backed Socket.IO scaling, presence, message fan-out и multi-key state в NestJS/Node.js. Прямо предупреждает не читать idempotency state с реплик; это существенно для NOVA message delivery.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/redis/agent-skills/main/LICENSE. Исходное описание: MIT; copyright holder: Redis, Inc. (LICENSE: Copyright (c) 2026 Redis, Inc.).
- **Последнее обновление:** 2026-11-05T15:01:14Z (Atom: https://github.com/redis/agent-skills/commits/main.atom)
- **Зависимости:** Не заявлены для самого skill; практические примеры используют Redis Cluster/replication и Python redis-клиент только как иллюстрацию. Node.js-пакет/версия не указаны.
- **Безопасность:** SKILL.md не содержит install-команд, curl|bash или запросов токенов; примеры — Redis команды и конфигурационные решения. В репозитории есть scripts/ синхронизации/валидации plugin-копий, они не запускались; сетевые обращения возможны только при последующей установке/использовании Redis, не при чтении skill.
- **Установка для Codex:** README документирует Agent Skills CLI: `npx skills add redis/agent-skills`; для Codex также документирован plugin package в `plugins/redis-development/` с `.codex-plugin/plugin.json`, но отдельная команда `codex add` не указана.
- **Проверка ссылки:** ok
- **Примечание:** Проверены raw SKILL.md, raw LICENSE и Atom. Не дубликат redis-core: этот skill закрывает topology, slotting и consistency boundaries, а не выбор data structure. Для NOVA особенно важна рекомендация не использовать replica reads для idempotency/strict-freshness state.

### android-cicd

- **Категории:** Release Engineering
- **Репозиторий:** https://github.com/davila7/claude-code-templates
- **SKILL.md:** https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/skills/development/android-cicd/SKILL.md
- **Назначение:** Настройка многоэтапного Android CI/CD в GitHub Actions с keystore generation, GitHub Secrets, versionCode bump и публикацией на internal/alpha/beta/production Google Play tracks; поддерживает native Android Gradle.
- **Совместимость с NOVA:** Нативный Android Gradle прямо поддержан; применим к APK signing/versioning и GitHub Actions NOVA. Skill также описывает другие фреймворки, но они для NOVA не нужны.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/davila7/claude-code-templates/main/LICENSE. Исходное описание: MIT; LICENSE: Copyright (c) 2025 Daniel (San) Ávila.
- **Последнее обновление:** 2026-11-15T16:23:35Z (первый <updated> из https://github.com/davila7/claude-code-templates/commits/main.atom)
- **Зависимости:** Node.js >=18, `npx android-cicd`, JDK 17/keytool, `gh` CLI с `gh auth login`, Android Gradle project, Google Play Console/API, Play App Signing, service-account JSON и GitHub Secrets.
- **Безопасность:** В SKILL.md есть install/execute-команда `npx android-cicd`; wizard генерирует keystore, меняет GitHub Secrets и создаёт workflow. Документированы чувствительные secrets KEYSTORE_FILE/PASSWORD, KEY_ALIAS/PASSWORD и GOOGLE_PLAY_SERVICE_ACCOUNT_JSON, а также API/gh network access. Скрипты/установщики не запускались.
- **Установка для Codex:** Codex-установка в самом skill/repo не документирована; вручную: `git clone https://github.com/davila7/claude-code-templates.git ~/.codex/skills/android-cicd` (notes: repository documents `npx android-cicd` for the skill's setup wizard, not a Codex plugin installation).
- **Проверка ссылки:** ok
- **Примечание:** Сильное покрытие signing/versioning/Google Play/GitHub Actions. Перед применением требуется ручная проверка разрешений service account и хранение signing secrets только в GitHub Secrets.

### gplay-release-flow

- **Категории:** Release Engineering
- **Репозиторий:** https://github.com/tamtom/gplay-cli-skills
- **SKILL.md:** https://raw.githubusercontent.com/tamtom/gplay-cli-skills/main/skills/gplay-release-flow/SKILL.md
- **Назначение:** End-to-end Google Play release flow: upload AAB/APK, internal/beta/production tracks, promotion, staged rollout, release notes, metadata и dry-run через gplay CLI.
- **Совместимость с NOVA:** Прямо применим к Android APK/AAB NOVA и Google Play release process; не зависит от Expo/React Native/Flutter.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/tamtom/gplay-cli-skills/main/LICENSE. Исходное описание: MIT; LICENSE: Copyright (c) 2025 (holder name в видимой строке не указан).
- **Последнее обновление:** 2026-07-26T10:00:43Z (первый <updated> из https://github.com/tamtom/gplay-cli-skills/commits/main.atom)
- **Зависимости:** gplay CLI, Google Play Android Developer API, service-account credentials или `gplay auth login`; `jq` нужен для ручного edit-sequence из SKILL.md; сеть к Google Play.
- **Безопасность:** Команды выполняют upload/publish/rollout в Google Play. SKILL.md требует `gplay auth login` или `GPLAY_SERVICE_ACCOUNT`, Release Manager permission и работу с bundle/release-notes файлами. Токены/секреты не печатать; scripts/ и curl|bash в skill не заявлены.
- **Установка для Codex:** README документирует: `npx skills add tamtom/gplay-cli-skills`.
- **Проверка ссылки:** ok
- **Примечание:** Закрывает критичный NOVA release workflow, включая APK/AAB, version code и staged rollout. Команды в отчёте не выполнялись.

### playwright-e2e-testing

- **Категории:** Testing and QA
- **Репозиторий:** https://github.com/fugazi/test-automation-skills-agents
- **SKILL.md:** https://raw.githubusercontent.com/fugazi/test-automation-skills-agents/main/skills/playwright-e2e-testing/SKILL.md
- **Назначение:** Playwright E2E на TypeScript для browser flows, auth/forms/navigation, responsive checks, fixtures/Page Objects, API setup, mocking/interception, traces/screenshots/videos и visual regression.
- **Совместимость с NOVA:** Прямо совместим с NOVA web Next.js + React + TypeScript и OTP/email auth flows; может проверять backend API через request fixture, но standalone contract testing в самом skill отнесён к отдельному api-testing skill.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/fugazi/test-automation-skills-agents/main/LICENSE. Исходное описание: MIT; copyright holder Douglas Urrea Ocampo (подтверждено https://raw.githubusercontent.com/fugazi/test-automation-skills-agents/main/LICENSE).
- **Последнее обновление:** 2026-11-09T22:42:23Z (api.github.com/repos/fugazi/test-automation-skills-agents, pushed_at)
- **Зависимости:** Node.js v18+; npm/yarn/pnpm; @playwright/test; TypeScript; optional ts-node; browsers installed through npx playwright install; network/app URL and test data.
- **Безопасность:** SKILL.md документирует npx playwright install, browser execution, screenshots/videos/traces, network interception and API requests; test credentials/test data and OTP handling must be isolated. README reports scripts/lint-skills.mjs; no curl|bash or token request in this skill. Install/lint commands не запускались.
- **Установка для Codex:** Codex не документирован; вручную: git clone https://github.com/fugazi/test-automation-skills-agents.git ~/.codex/skills/test-automation-skills-agents
- **Проверка ссылки:** ok
- **Примечание:** Raw SKILL.md и LICENSE реально открыты. README документирует Claude Code marketplace, Copilot и ручное копирование, но Codex-specific command не найден; поэтому приведён разрешённый manual clone fallback. Критично для Next.js web E2E и OTP/navigation regression.

### react-nextjs-development

- **Категории:** Web Frontend
- **Репозиторий:** https://github.com/sickn33/antigravity-awesome-skills
- **SKILL.md:** https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/skills/react-nextjs-development/SKILL.md
- **Назначение:** Workflow для React и Next.js с App Router, Server Components, TypeScript, Tailwind CSS, современными frontend-паттернами, data fetching и компонентной архитектурой.
- **Совместимость с NOVA:** Совместим с web-частью NOVA: Next.js App Router, React 19, TypeScript и Tailwind. SKILL.md рассчитан на Next.js 14+ и предупреждает проверять фактические версии caching, route params и server/client API; это полезно при переходе на React 19/новые Next.js.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/LICENSE. Исходное описание: MIT для репозитория; copyright holder: Antigravity User (подтверждено https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/LICENSE). README уточняет, что импортированные skills могут сохранять собственные условия, поэтому для конкретного файла следует дополнительно проверить attribution.
- **Последнее обновление:** 2026-11-14T16:18:00Z (GitHub API pushed_at; default branch main); проверка Atom: 2026-11-12T18:58:46Z
- **Зависимости:** Не заявлены как обязательные runtime-пакеты; SKILL.md перечисляет Next.js 14+, React, TypeScript, Tailwind CSS, ESLint/Prettier и опционально связанные skills (app-builder, nextjs-app-router-patterns, react-state-management/SWR).
- **Безопасность:** SKILL.md содержит рекомендации держать секреты server-only, валидировать runtime inputs и не считать UI guards заменой авторизации. Для репозитория документированы gh skill preview/install и GitHub CLI; это сетевые install-команды, не запускались. В репозитории есть scripts/ и другие tooling-скрипты, но skill-specific SKILL.md не требует их запуска; curl|bash и запросы токенов в проверенном SKILL.md не обнаружены.
- **Установка для Codex:** gh skill preview sickn33/agentic-awesome-skills skills/react-nextjs-development/SKILL.md@v20.8.0; gh skill install sickn33/agentic-awesome-skills skills/react-nextjs-development/SKILL.md --agent codex --scope user --pin v20.8.0. Команды взяты из README репозитория (путь в README использует официальный переименованный репозиторий agentic-awesome-skills).
- **Проверка ссылки:** ok
- **Примечание:** SKILL.md и LICENSE реально открыты через raw.githubusercontent.com. Это workflow-bundle, а не узкий production runtime skill; применять выборочно и не устанавливать весь каталог awesome skills.


## Дополнительные навыки (4)

### kotlin-tooling-agp9-migration

- **Категории:** Android Engineering
- **Репозиторий:** https://github.com/Kotlin/kotlin-agent-skills
- **SKILL.md:** https://raw.githubusercontent.com/Kotlin/kotlin-agent-skills/main/skills/kotlin-tooling-agp9-migration/SKILL.md
- **Назначение:** Официальный Kotlin/JetBrains skill для миграции Kotlin Multiplatform-проектов на Android Gradle Plugin 9+: plugin replacement, разделение androidApp/shared, DSL, KSP/KAPT и совместимость плагинов.
- **Совместимость с NOVA:** Совместим с Kotlin/Gradle Android tooling, но для текущего NOVA native Android APK не является ежедневным skill: критичен только если проект использует KMP или выполняет AGP 9 migration.
- **Лицензия:** Apache-2.0; проверено по https://raw.githubusercontent.com/Kotlin/kotlin-agent-skills/main/LICENSE. Исходное описание: Apache-2.0; LICENSE содержит стандартный текст, отдельный copyright holder в проверенном файле не указан; SKILL.md также явно указывает Apache-2.0.
- **Последнее обновление:** 2026-10-30T21:37:51Z (первый <updated> из https://github.com/Kotlin/kotlin-agent-skills/commits/main.atom)
- **Зависимости:** Gradle wrapper, Android Gradle Plugin 9+, Kotlin/AGP DSL, KSP или legacy-kapt по сценарию; в skill также есть `scripts/analyze-project.sh`.
- **Безопасность:** В skill присутствует scripts/analyze-project.sh и явно предлагается запустить его; не запускался. Скрипт потенциально читает структуру/Gradle-файлы проекта. Нет curl|bash и нет запроса токенов в проверенном SKILL.md.
- **Установка для Codex:** README документирует: `codex plugin marketplace add Kotlin/kotlin-agent-skills`, затем в Codex открыть `/plugins`, найти `kotlin-agent-skills` и выбрать Install plugin. Дополнительно документирован `codex mcp add kotlinlang --url https://mcp.kotlinlang.org/mcp` для Kotlin documentation MCP.
- **Проверка ссылки:** ok
- **Примечание:** Официальный репозиторий Kotlin. Для NOVA (не KMP) это нишевый upgrade/tooling skill, а не базовый Kotlin/Gradle build guide.

### broken-authentication

- **Категории:** Authentication and Security
- **Репозиторий:** https://github.com/sickn33/antigravity-awesome-skills
- **SKILL.md:** https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/skills/broken-authentication/SKILL.md
- **Назначение:** Authorized defensive assessment of broken authentication and session-management weaknesses, including password policies, session handling, MFA, credential management, and account-takeover risks. Useful as a security-test checklist for OTP, JWT/session rotation, rate limits, and private messaging authorization.
- **Совместимость с NOVA:** Web/API-oriented and compatible with the NestJS/Node.js backend, Next.js web app, WebSocket authorization, and Android client threat model. It is an assessment playbook, not a Kotlin or NestJS package.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/LICENSE. Исходное описание: MIT; copyright holder shown in LICENSE as Antigravity User (verified from https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/LICENSE).
- **Последнее обновление:** 2026-11-12T18:58:46Z (first updated in https://github.com/sickn33/antigravity-awesome-skills/commits/main.atom)
- **Зависимости:** Knowledge of HTTP, sessions, authentication types (SFA/2FA/MFA), and an explicitly authorized test target; any concrete scanners/tools are prerequisites only where the selected assessment requires them.
- **Безопасность:** The SKILL.md is explicitly offensive-capable and requires written authorization, exact target/scope confirmation, command review, and a confirmation gate before probing, exploitation, credential access, or changes. Treat network probing and credential-related actions as high risk; never run its commands against NOVA without separate authorization. Repository is a large catalog, so inspect the individual skill before activation.
- **Установка для Codex:** gh skill install sickn33/agentic-awesome-skills skills/broken-authentication/SKILL.md --agent codex --scope user --pin v20.8.0 (the repository README documents this installation form; verify the pin against the desired release before use).
- **Проверка ссылки:** ok
- **Примечание:** Included only as an authorized security-testing complement, not as an implementation guide. Its offensive scope makes it unsuitable as a default always-on skill for NOVA.

### quality-documentation-manager

- **Категории:** Documentation
- **Репозиторий:** https://github.com/alirezarezvani/claude-skills
- **SKILL.md:** https://raw.githubusercontent.com/alirezarezvani/claude-skills/main/ra-qm-team/skills/quality-documentation-manager/SKILL.md
- **Назначение:** Контроль документов: numbering, versioning, review/approval workflow, change control, audit trail и lifecycle. Может быть адаптирован для управляемых ADR, API specs, runbooks и release documentation.
- **Совместимость с NOVA:** Совместим с GitHub/Git-based документацией NOVA на уровне процессов, но содержание ориентировано на ISO 13485/QMS и 21 CFR Part 11, что для обычного consumer/backend-продукта NOVA избыточно. Применимость к стеку косвенная.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/alirezarezvani/claude-skills/main/LICENSE. Исходное описание: MIT; copyright holder: Copyright (c) 2025 Alireza Rezvani (LICENSE в корне репозитория).
- **Последнее обновление:** 2026-11-12T10:35:06Z (первый updated в https://github.com/alirezarezvani/claude-skills/commits/main.atom)
- **Зависимости:** Python 3 для scripts/document_validator.py; JSON document input. Reference-файлы document-control-procedures.md и 21cfr11-compliance-guide.md. Пакеты и внешние runtime не заявлены.
- **Безопасность:** В SKILL.md заявлены scripts/document_validator.py с локальными JSON-файлами; команды не запускались. Обрабатывает audit trail, user identity и electronic signatures, поэтому входные документы могут содержать персональные/регуляторные данные. Сетевые обращения, curl|bash и запросы токенов не заявлены. Validator не сертифицирует compliance — это прямо оговорено в skill.
- **Установка для Codex:** Репозиторий README документирует: npx skills add alirezarezvani/claude-skills. Это installer-команда, не запускалась.
- **Проверка ссылки:** ok
- **Примечание:** Включён как нишевый documentation governance skill, а не как прямой API-doc generator. Для NOVA полезен только если нужны строгие approval/change-control процессы; иначе architecture-designer и обычные docs tooling будут релевантнее.

### video-editing

- **Категории:** Media Processing
- **Репозиторий:** https://github.com/affaan-m/ecc
- **SKILL.md:** https://raw.githubusercontent.com/affaan-m/ecc/main/skills/video-editing/SKILL.md
- **Назначение:** Детерминированный workflow обработки существующего видео: FFmpeg для cut/concat/proxy/audio extraction/normalization, Remotion для overlays и compositing, подготовка субтитров и финального экспорта.
- **Совместимость с NOVA:** Совместим с Node.js backend и CI/CD GitHub Actions для media preprocessing; FFmpeg-команды применимы к upload pipeline NOVA, а Remotion — к TypeScript/web tooling. Не является Android Compose testing skill.
- **Лицензия:** MIT; проверено по https://raw.githubusercontent.com/affaan-m/ecc/main/LICENSE. Исходное описание: MIT; copyright holder Affaan Mustafa (подтверждено https://raw.githubusercontent.com/affaan-m/ecc/main/LICENSE).
- **Последнее обновление:** 2026-11-15T06:48:46Z (api.github.com/repos/affaan-m/ecc, pushed_at); проверка Atom: 2026-11-06T21:21:50Z
- **Зависимости:** FFmpeg; Node.js 18+ для universal package; Remotion/React для programmable composition; optional ElevenLabs, fal.ai, Descript или CapCut по workflow; локальные video/audio files. Точные версии Remotion не заявлены в SKILL.md.
- **Безопасность:** SKILL.md содержит shell-команды ffmpeg, чтение/запись локальных media-файлов и batch-скрипт с while loop; README репозитория содержит scripts/ и install-команды, а также внешние интеграции/API. Секреты требуются только для optional внешних сервисов; команды и установщики не запускались.
- **Установка для Codex:** `codex plugin marketplace add affaan-m/ECC && codex plugin add ecc@ecc`
- **Проверка ссылки:** ok
- **Примечание:** Raw SKILL.md подтверждён. В отличие от генеративных media skills, этот skill ориентирован на обработку существующих upload-файлов и FFmpeg. Codex marketplace install прямо документирован README; проверка была чтением, без выполнения команд.


## Каталог по категориям

### Accessibility
- **android-accessibility** (mandatory) — Чеклист аудита Android accessibility именно для Jetpack Compose: contentDescription, декоративные изображения, touch target 48dp, WCAG contrast, focus order, merged semantics, stateDescription, headings и TalkBack. [SKILL.md](https://raw.githubusercontent.com/new-silvermoon/awesome-android-agent-skills/main/.github/skills/ui/android-accessibility/SKILL.md)
- **accessibility-lead** (recommended) — Роутер accessibility review для web UI: классифицирует изменения, dispatch-ит specialist skills, объединяет findings и выносит ship/no-ship verdict; явно эскалирует Android на mobile-accessibility. [SKILL.md](https://raw.githubusercontent.com/Community-Access/accessibility-agents/main/skills/accessibility-lead/SKILL.md)
- **wcag-audit-patterns** (recommended) — WCAG 2.2 audit patterns для web: POUR, conformance A/AA/AAA, keyboard access, form labels, alt text, focus outlines, contrast, skip links, landmarks, headings и manual-plus-automated verification. [SKILL.md](https://raw.githubusercontent.com/wshobson/agents/main/plugins/accessibility-compliance/skills/wcag-audit-patterns/SKILL.md)

### Android Engineering
- **jetpack-compose-performance** (mandatory) — Официальный Android skill для аудита и оптимизации производительности Jetpack Compose: состояние и стабильность, layout/lazy layouts, эффекты, графика, Modifier.Node, baseline profiles и release-профилирование. [SKILL.md](https://raw.githubusercontent.com/android/skills/main/jetpack-compose/jetpack-compose-performance/SKILL.md)
- **compose-state-and-effects** (recommended) — Практический skill для владения состоянием Compose, state hoisting, screen state holders, LaunchedEffect/DisposableEffect/SideEffect, Flow collection, navigation, snackbar, analytics и focus. [SKILL.md](https://raw.githubusercontent.com/chrisbanes/skills/main/skills/compose-state-and-effects/SKILL.md)
- **kotlin-tooling-agp9-migration** (optional) — Официальный Kotlin/JetBrains skill для миграции Kotlin Multiplatform-проектов на Android Gradle Plugin 9+: plugin replacement, разделение androidApp/shared, DSL, KSP/KAPT и совместимость плагинов. [SKILL.md](https://raw.githubusercontent.com/Kotlin/kotlin-agent-skills/main/skills/kotlin-tooling-agp9-migration/SKILL.md)

### Authentication and Security
- **security-and-hardening** (mandatory) — Production-oriented security hardening for untrusted input, authentication and session flows, secrets, authorization, dependency/supply-chain risk, secure storage, and OWASP-style review. Directly useful for the NestJS API, Next.js web client, Socket.IO/WebSocket boundaries, GitHub Actions, and OTP/JWT design review. [SKILL.md](https://raw.githubusercontent.com/addyosmani/agent-skills/main/skills/security-and-hardening/SKILL.md)
- **broken-authentication** (optional) — Authorized defensive assessment of broken authentication and session-management weaknesses, including password policies, session handling, MFA, credential management, and account-takeover risks. Useful as a security-test checklist for OTP, JWT/session rotation, rate limits, and private messaging authorization. [SKILL.md](https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/skills/broken-authentication/SKILL.md)

### Backend Engineering
- **nestjs-architecture-principles** (mandatory) — Проектирование и ревью NestJS-модулей, границ capability, dependency direction, ports/adapters, data/transaction ownership и устранение циклических зависимостей. [SKILL.md](https://raw.githubusercontent.com/amirtaherkhani/nestjs-skills/main/skills/nestjs-architecture-principles/SKILL.md)
- **nestjs-professional-software-engineering** (mandatory) — Основной implementation skill для NestJS: инспекция существующего проекта, version-compatible реализация, тестирование, validation, API ergonomics и безопасная проверка изменений. [SKILL.md](https://raw.githubusercontent.com/amirtaherkhani/nestjs-skills/main/skills/nestjs-professional-software-engineering/SKILL.md)

### Database Engineering
- **postgresql-best-practices** (mandatory) — Маршрутизация и практические рекомендации по PostgreSQL: таблицы, индексы, JSONB, партиционирование, RLS, полнотекстовый поиск, connection pooling, репликация, backup и безопасные операции; содержит отдельные правила для managed PostgreSQL/Azure. [SKILL.md](https://raw.githubusercontent.com/microsoft/postgres-skills/main/plugin/skills/postgresql-best-practices/SKILL.md)
- **database-schema-design** (recommended) — Проектирование нормализованных SQL-схем, связей, индексов и миграций; даёт примеры PostgreSQL, raw SQL/Flyway, Prisma и Alembic, включая partial/composite/GIN индексы, FK, TIMESTAMPTZ, rollback и updated_at. [SKILL.md](https://raw.githubusercontent.com/timwukp/agent-skills-best-practice/main/skills/skills/database-schema-design/SKILL.md)
- **redis-core** (recommended) — Выбор Redis data structures по access pattern (Hash, Set, Sorted Set, Stream и др.) и единообразное именование ключей; покрывает cache/session state, counters, recent-items и persistent fan-out/event-log сценарии. [SKILL.md](https://raw.githubusercontent.com/redis/agent-skills/main/skills/redis-core/SKILL.md)

### Design Systems
- **Material Design 3 Skill** (mandatory) — Material 3/Material You guidance for tokens, 30+ components, Compose-first Android theming, dynamic color, adaptive layouts, M3 Expressive, accessibility and compliance audits. Useful as the shared design-system contract for NOVA Android UI. [SKILL.md](https://raw.githubusercontent.com/hamen/material-3-skill/master/skills/material-3/SKILL.md)
- **Platform Design Skills — Android** (recommended) — Android-specific Material Design 3 and WCAG-oriented rules for Material You, dynamic color, navigation, components, accessibility and platform behavior; part of a broader cross-platform pack. [SKILL.md](https://raw.githubusercontent.com/ehmo/platform-design-skills/main/skills/android/SKILL.md)

### DevOps and CI/CD
- **deployment-patterns** (mandatory) — Практические шаблоны deployment для web/backend: GitHub Actions CI/CD, multi-stage Docker, health/readiness checks, rolling/blue-green/canary deployment, rollback, production readiness и monitoring checklist. [SKILL.md](https://raw.githubusercontent.com/affaan-m/ECC/main/skills/deployment-patterns/SKILL.md)
- **docker-expert** (recommended) — Экспертная проверка и проектирование Docker: multi-stage builds, .dockerignore, non-root, secrets, Compose networks/healthchecks, resource limits, image optimization, BuildKit cache, multi-arch и production hardening. [SKILL.md](https://raw.githubusercontent.com/sickn33/agentic-awesome-skills/main/skills/docker-expert/SKILL.md)

### Mobile UI/UX
- **Compose Expert** (mandatory) — Deep Jetpack Compose implementation and review guidance covering Material 3 theming/motion, accessibility, adaptive layouts, navigation, state, performance, atomic design systems, design tokens and design-to-code workflows, backed by AndroidX/Compose source receipts. [SKILL.md](https://raw.githubusercontent.com/aldefy/compose-skill/master/skills/compose-expert/SKILL.md)
- **Android Compose Design** (recommended) — Native Android Compose UI/UX guidance focused on distinctive but production-grade Material 3 interfaces, custom themes, color/typography/shape tokens, hierarchy, motion, edge-to-edge, accessibility, dynamic type and approximately 48dp touch targets. [SKILL.md](https://raw.githubusercontent.com/NI3singh/android-compose-design-skill/main/SKILL.md)

### Performance Engineering
- **performance** (mandatory) — Evidence-led оптимизация загрузки и runtime performance: field/lab measurement, browser traces, critical rendering path, resource delivery, caching, code splitting и budgets. [SKILL.md](https://raw.githubusercontent.com/addyosmani/web-quality-skills/main/skills/performance/SKILL.md)
- **core-web-vitals** (recommended) — Специализированная диагностика и оптимизация LCP, INP и CLS по CrUX/field данным и browser performance traces, включая LCP resource discovery, TTFB, render blocking и prerender trade-offs. [SKILL.md](https://raw.githubusercontent.com/addyosmani/web-quality-skills/main/skills/core-web-vitals/SKILL.md)
- **web-performance-optimization** (recommended) — Практический checklist и примеры для code splitting, lazy loading, image optimization, service-worker caching, compression и мониторинга LCP/INP/CLS. [SKILL.md](https://raw.githubusercontent.com/secondsky/claude-skills/main/plugins/web-performance-optimization/skills/web-performance-optimization/SKILL.md)

### Real-time Messaging
- **websocket-engineer** (mandatory) — Проектирование WebSocket/Socket.IO систем: auth handshake, rooms/namespaces, acknowledgments, Redis adapter/pub-sub, sticky sessions, heartbeat, reconnection/backoff, presence, queueing during disconnect, limits и monitoring. [SKILL.md](https://raw.githubusercontent.com/jeffallan/claude-skills/main/skills/websocket-engineer/SKILL.md)
- **redis-clustering** (recommended) — Redis Cluster/replication: hash tags для multi-key операций, предотвращение CROSSSLOT, pipeline/transaction/Lua key placement и read replicas с явным предупреждением об eventual consistency. [SKILL.md](https://raw.githubusercontent.com/redis/agent-skills/main/skills/redis-clustering/SKILL.md)

### Testing and QA
- **android-testing** (mandatory) — Стратегия Android testing: unit tests, Hilt integration tests, Room/Retrofit с MockWebServer и Compose screenshot tests через Roborazzi; включает Gradle commands и примеры JUnit/Compose/Hilt. [SKILL.md](https://raw.githubusercontent.com/new-silvermoon/awesome-android-agent-skills/main/.github/skills/testing_and_automation/android-testing/SKILL.md)
- **nestjs-testing** (mandatory) — NestJS unit/E2E testing с Jest, Test.createTestingModule, typed mocks, Supertest, real test DB, cleanup, authorization/security tests и contract-compliance assertions. [SKILL.md](https://raw.githubusercontent.com/HoangNguyen0403/agent-skills-standard/develop/skills/nestjs/nestjs-testing/SKILL.md)
- **playwright-e2e-testing** (recommended) — Playwright E2E на TypeScript для browser flows, auth/forms/navigation, responsive checks, fixtures/Page Objects, API setup, mocking/interception, traces/screenshots/videos и visual regression. [SKILL.md](https://raw.githubusercontent.com/fugazi/test-automation-skills-agents/main/skills/playwright-e2e-testing/SKILL.md)

### Web Frontend
- **nextjs-shadcn** (mandatory) — Практика построения компонентов в Next.js App Router с shadcn/ui, Tailwind CSS v4 и доступными примитивами Base UI, Radix UI или React Aria; охватывает формы, overlays, таблицы, навигацию и MCP registry. [SKILL.md](https://raw.githubusercontent.com/fusengine/agents/main/plugins/nextjs-expert/skills/nextjs-shadcn/SKILL.md)
- **react-nextjs-development** (recommended) — Workflow для React и Next.js с App Router, Server Components, TypeScript, Tailwind CSS, современными frontend-паттернами, data fetching и компонентной архитектурой. [SKILL.md](https://raw.githubusercontent.com/sickn33/antigravity-awesome-skills/main/skills/react-nextjs-development/SKILL.md)

### AI Agent Engineering
- **mcp-server-builder** (recommended) — Создание MCP-серверов из OpenAPI-контрактов для Python или TypeScript, генерация tool manifest/scaffold, проверка схем, naming, auth strategy и backward compatibility. [SKILL.md](https://raw.githubusercontent.com/alirezarezvani/claude-skills/main/engineering/skills/mcp-server-builder/SKILL.md)
- **prompt-engineer** (recommended) — Проектирование, рефакторинг и оценка LLM-промптов, structured outputs, JSON/function-calling schemas, guardrails, few-shot и prompt evaluation; подходит для OTP-потоков, личных сообщений и agent-функций NOVA. [SKILL.md](https://raw.githubusercontent.com/Jeffallan/claude-skills/main/skills/prompt-engineer/SKILL.md)

### API Engineering
- **nestjs-features-performance** (recommended) — NestJS lifecycle, API/error/security contracts, pipes, guards, interceptors, exception filters, DTO/validation, Problem Details, HTTP/WebSocket mapping, reliability и performance. [SKILL.md](https://raw.githubusercontent.com/amirtaherkhani/nestjs-skills/main/skills/nestjs-features-performance/SKILL.md)
- **senior-backend-dev** (recommended) — Широкий backend/API skill для production REST/GraphQL/gRPC: resource-oriented endpoints, HTTP semantics, validation, consistent errors, pagination, idempotency, OpenAPI/Swagger и code review. [SKILL.md](https://raw.githubusercontent.com/codewithowais/senior-backend-dev/master/SKILL.md)

### Documentation
- **architecture-designer** (recommended) — Высокоуровневая архитектура, ADR, анализ trade-offs, scalability planning, component interactions и Mermaid-диаграммы. [SKILL.md](https://raw.githubusercontent.com/Jeffallan/claude-skills/main/skills/architecture-designer/SKILL.md)
- **quality-documentation-manager** (optional) — Контроль документов: numbering, versioning, review/approval workflow, change control, audit trail и lifecycle. Может быть адаптирован для управляемых ADR, API specs, runbooks и release documentation. [SKILL.md](https://raw.githubusercontent.com/alirezarezvani/claude-skills/main/ra-qm-team/skills/quality-documentation-manager/SKILL.md)

### Internationalization
- **i18n-localization** (recommended) — Practical i18n/l10n patterns for hardcoded-string detection, translation keys and namespaces, locale files, pluralization, Intl date/number formatting, fallback languages, RTL, and CSS logical properties. Useful as a lightweight review checklist for Next.js/React and locale-aware UI. [SKILL.md](https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/skills/development/i18n-localization/SKILL.md)
- **i18next-localization** (recommended) — Version-matched i18next localization workflow: detect stack, configure locales, instrument hardcoded strings, extract keys, lint placeholders/plurals, and optionally sync with Locize. Direct fit for the Next.js + React + TypeScript web application and useful for localized auth/error messages. [SKILL.md](https://raw.githubusercontent.com/i18next/i18next-cli/main/skills/i18next-localization/SKILL.md)
- **internationalization-and-localization** (recommended) — Framework-neutral i18n/l10n protocol covering string extraction, stable keys, plural/gender rules, text expansion, RTL, locale-aware dates/numbers/collation, pseudo-localization, fallback behavior, and API locale negotiation. Useful across NOVA web, Android, email, push, and backend error contracts. [SKILL.md](https://raw.githubusercontent.com/arneesh/agent-protocols/master/skills/internationalization-and-localization/SKILL.md)

### Media Processing
- **transloadit-media-processing** (recommended) — Облачные pipeline для видео, аудио, изображений и документов: кодирование HLS/MP4/WebM, thumbnails, resize/crop/watermark, конвертация JPEG/PNG/WebP/AVIF/HEIF, извлечение и транскодирование аудио, OCR и экспорт в хранилища. [SKILL.md](https://raw.githubusercontent.com/github/awesome-copilot/main/skills/transloadit-media-processing/SKILL.md)
- **video-editing** (optional) — Детерминированный workflow обработки существующего видео: FFmpeg для cut/concat/proxy/audio extraction/normalization, Remotion для overlays и compositing, подготовка субтитров и финального экспорта. [SKILL.md](https://raw.githubusercontent.com/affaan-m/ecc/main/skills/video-editing/SKILL.md)

### Motion Design
- **animate** (recommended) — Строит UI-анимацию с последовательным выбором: нужна ли motion вообще, её цель, инструмент, свойства, curve/duration, interruptibility, exit и reduced-motion/hover gating. [SKILL.md](https://raw.githubusercontent.com/emilkowalski/skills/main/skills/animate/SKILL.md)
- **motion-design** (recommended) — Применяет motion-принципы к UI-анимациям: эмоциональное намерение, narrative/choreography, timing, easing, property selection, feedback, loading/error/success states, scroll effects и brand motion identity. [SKILL.md](https://raw.githubusercontent.com/LottieFiles/motion-design-skill/main/skills/motion-design/SKILL.md)

### Product Design
- **product-design** (recommended) — Проектирует поведение продукта до реализации: выбор контролов и взаимодействий, область действия, последствия, обратимость, восстановление и полный набор достижимых состояний. [SKILL.md](https://raw.githubusercontent.com/mblode/agent-skills/main/skills/product-design/SKILL.md)
- **ui-design** (recommended) — Задаёт визуальное направление, дизайн-токены, responsive/dark-mode решения, сборку React/Next UI и аудит визуальных и интерактивных дефектов с доказательствами и ship verdict. [SKILL.md](https://raw.githubusercontent.com/mblode/agent-skills/main/skills/ui-design/SKILL.md)
- **ux-writing** (recommended) — Пишет и редактирует пользовательский микрокопирайт: кнопки, labels, ошибки, уведомления, формы, onboarding, empty/success states, help text; применяет стандарты purposeful, concise, conversational, clear и accessibility-практики. [SKILL.md](https://raw.githubusercontent.com/content-designer/ux-writing-skill/main/SKILL.md)

### Product Management
- **create-prd** (recommended) — Lean, decision-ready PRD: problem/background, objective and measurable key results, market segments, JTBD value propositions, solution, assumptions/open questions, release scope, user stories and engineering handoff context. Explicitly avoids inventing unknown facts and supports review of existing PRDs. [SKILL.md](https://raw.githubusercontent.com/phuryn/pm-skills/main/pm-execution/skills/create-prd/SKILL.md)
- **deliver-prd** (recommended) — Comprehensive PRD for engineering handoff: problem, measurable goals, solution, testable functional requirements, scope boundaries, technical considerations, dependencies/risks, milestones, open questions, plus conditional AI evaluation and agent execution contract. [SKILL.md](https://raw.githubusercontent.com/product-on-purpose/pm-skills/main/skills/deliver-prd/SKILL.md)
- **launch-plan** (recommended) — Plans launch readiness using silent, soft and big-bang tiers; supplies product/content/distribution/support/measurement checklists, rollback requirements, ownership and post-launch review cadence. [SKILL.md](https://raw.githubusercontent.com/assimovt/productskills/main/skills/launch-plan/SKILL.md)
- **metrics-dashboard** (recommended) — Designs a product analytics dashboard using North Star, input, health and business metrics; defines exact calculations, data sources, visualizations, targets, alert thresholds and review cadence. [SKILL.md](https://raw.githubusercontent.com/phuryn/pm-skills/main/pm-product-discovery/skills/metrics-dashboard/SKILL.md)

### Release Engineering
- **android-cicd** (recommended) — Настройка многоэтапного Android CI/CD в GitHub Actions с keystore generation, GitHub Secrets, versionCode bump и публикацией на internal/alpha/beta/production Google Play tracks; поддерживает native Android Gradle. [SKILL.md](https://raw.githubusercontent.com/davila7/claude-code-templates/main/cli-tool/components/skills/development/android-cicd/SKILL.md)
- **gplay-release-flow** (recommended) — End-to-end Google Play release flow: upload AAB/APK, internal/beta/production tracks, promotion, staged rollout, release notes, metadata и dry-run через gplay CLI. [SKILL.md](https://raw.githubusercontent.com/tamtom/gplay-cli-skills/main/skills/gplay-release-flow/SKILL.md)

## Пять design-источников, проверенных ранее

Эти репозитории уже были проверены в `docs/design-skills-review.md` и использованы как reference-материалы, а не как автоматически подключённые зависимости. У всех подтверждена MIT-лицензия на материалы репозитория; сторонние изображения, шрифты и брендинг требуют отдельной проверки.

| Источник | Тип | Репозиторий | SKILL.md / спецификация | Лицензия | Обновлён | Применимость |
|---|---|---|---|---|---|---|
| Taste Skill | Agent skill | https://github.com/Leonxlnx/taste-skill | https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md | MIT | 2026-11-07 | Web — высоко; Android — ограниченно, переносить принципы вручную |
| UI UX Pro Max | Agent skill + rules catalog | https://github.com/nextlevelbuilder/ui-ux-pro-max-skill | https://raw.githubusercontent.com/nextlevelbuilder/ui-ux-pro-max-skill/main/.claude/skills/ui-ux-pro-max/SKILL.md | MIT | 2026-11-14 | Android Compose и web — высоко; не Android SDK/Gradle tooling |
| Awesome Claude Design | Community catalog | https://github.com/VoltAgent/awesome-claude-design | README (нет SKILL.md) | MIT | 2026-05-25 | Косвенно: структура design brief/spec |
| Design Motion Principles | Agent skill | https://github.com/kylezantos/design-motion-principles | https://raw.githubusercontent.com/kylezantos/design-motion-principles/main/skills/design-motion-principles/SKILL.md | MIT | 2026-05-30 | Web — хорошо; Android — чеклист, не Compose-код |
| DESIGN.md Chrome | Chrome extension + blueprint | https://github.com/bergside/design-md-chrome | https://github.com/bergside/design-md-chrome/blob/main/DESIGN.md | MIT | 2026-05-25 | Структура токенов/spec; не готовая design system |

Ни один из пяти не устанавливался как upstream-пакет и не запускался. Вместо этого созданы локальные адаптации: `nova-taste`, `nova-uiux`, `nova-motion`, `nova-design-md`, `nova-release` (Manus skills в `/home/ubuntu/skills/`). Они сохраняют атрибуцию и лицензию источников и не содержат upstream-кода.


## Локально адаптированные skills NOVA

| Skill | Назначение | Источник |
|---|---|---|
| `nova-taste` | Визуальное направление, иерархия экрана, состояния loading/empty/error/offline | Taste Skill (MIT) |
| `nova-uiux` | Компоненты, формы, навигация, доступность, 48dp, IME, focus | UI UX Pro Max (MIT) |
| `nova-motion` | Motion-решения, тайминги 100–450 мс, reduced motion, Compose/web | Design Motion Principles (MIT) |
| `nova-design-md` | DESIGN.md, семантические токены, component contracts | Awesome Claude Design + DESIGN.md Chrome (MIT) |
| `nova-release` | Сборка, подпись, версионирование APK, GitHub Actions, web build | Правила NOVA (docs/build-and-deploy.md) |

## Исключено после проверки

Записи не прошли обязательную проверку прямой ссылки на `SKILL.md` или файла лицензии и не рекомендуются к установке.

- claude-code-mastery — https://github.com/borghei/Claude-Skills — license not verified (Commons Clause (source-available, not OSI))

## Происхождение и ограничения

Каталог собран из параллельного исследования 21 категории. Для каждой записи проверены: наличие `SKILL.md` (HTTP 200, непустое содержимое), файл лицензии в репозитории, дата последнего коммита через Atom-ленту, зависимости и потенциально опасные команды. Репозитории без подтверждённой лицензии исключены. Команда установки для Codex приведена так, как её документирует сам репозиторий; где Codex явно не поддержан, указана ручная установка и это отмечено в примечании. Перед установкой повторно прочитайте `SKILL.md` и `LICENSE`: каталог не заменяет аудит конкретной версии.
