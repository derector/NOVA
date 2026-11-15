# NOVA Android

Нативное Kotlin + Jetpack Compose приложение, `applicationId=io.nova.app`, `minSdk=26`, `targetSdk=35`; APK не использует WebView/Expo. Текущая локальная версия `0.1.2` (`versionCode=3`) включает фирменные adaptive/round launcher icons и улучшенную email/OTP форму.

## Сборка и тесты

Нужны JDK 21, Android SDK platform/build-tools 35 и интернет для разрешённых Gradle/Maven зависимостей. Из `android/`:

```sh
./gradlew --no-daemon :app:testDebugUnitTest :app:assembleDebug
```

APK появляется по пути `app/build/outputs/apk/debug/app-debug.apk`. Финальная handoff-сборка подписана постоянным debug-keystore NOVA; AAPT показывает package `io.nova.app`, version `0.1.2`, API 26–35, а `apksigner` подтвердил сертификат. Публичный SHA-256 fingerprint сертификата: `83:9C:E1:02:C3:DC:CF:79:6A:1D:4D:7C:7C:CA:35:78:88:A2:88:66:98:D1:04:C7:B5:C8:1F:FC:97:19:8E:4B`.

## Обновление установленного приложения

Предыдущий APK v0.1.1 был подписан другим/меняющимся CI debug key. Пользователь согласился удалить v0.1.1 один раз перед установкой v0.1.2; Android иначе может сообщить о конфликте подписи. Удаление удалит локальные данные приложения. После этого все новые APK должны сохранять тот же debug-keystore; не генерируйте другой ключ и не меняйте package ID. Для каждого обновления увеличивайте `versionCode`.

Приватный JKS и значения секретов не лежат в Git и не включены в handoff ZIP; в текущем sandbox они находятся вне проекта в `/home/ubuntu/.cache/nova/`. GitHub Actions workflow использует repository secrets `NOVA_DEBUG_KEY_BASE64`, `NOVA_DEBUG_STORE_PASSWORD`, `NOVA_DEBUG_KEY_ALIAS`, `NOVA_DEBUG_KEY_PASSWORD`, сверяет SHA-256 сертификата APK и удаляет временную копию JKS. При следующем сеансе сначала проверьте, что доступен тот же ключ; если он потерян и не был сохранён в GitHub Secrets, не создавайте новый до разговора с пользователем.

Для текущей версии GitHub Actions Secrets ещё не записаны: GitHub API ответил `403 Resource not accessible by integration`. Пока права не подключены, стабильная подпись работает в локальной сборке, но hosted CI новой рабочей копии не подтверждён.

## API URL и экран входа

`NOVA_API_BASE_URL` задаёт адрес backend. `http://10.0.2.2:3001` доступен **только Android Emulator** как host loopback. Физическому устройству нужен API URL, доступный самому устройству; для обычной эксплуатации — публичный HTTPS backend. LAN IP компьютера возможен только для временного теста в одной Wi-Fi сети. Незашифрованный HTTP разрешён лишь в debug build.

Экран входа валидирует email до запроса, предлагает email-клавиатуру/«Готово», отдельный цифровой OTP ввод, очистку и смену адреса, учитывает открытие экранной клавиатуры и сообщает, если запрос не дошёл до API. Эта диагностика не заменяет deployment: публичный API, PostgreSQL и Brevo sender/SMTP credentials пока не настроены, поэтому реальный email-вход на телефоне не заработает.

Production release требует отдельные release signing secrets и HTTPS API URL. Стабильный debug-keystore — не production key; храните их раздельно.
