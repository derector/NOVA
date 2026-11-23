# NOVA Android

Нативное приложение Kotlin + Jetpack Compose, `applicationId=io.nova.app`, `minSdk=26` (Android 8). Это не Expo и не WebView.

## Сборка и тесты

Нужны JDK 21, Android SDK platform/build-tools 35 и интернет для разрешённых Gradle/Maven зависимостей. Из `android/`:

```sh
./gradlew :app:assembleDebug
./gradlew :app:testDebugUnitTest
```

Debug APK: `app/build/outputs/apk/debug/app-debug.apk`. Он подписан debug-ключом и предназначен для разработки/проверки, не является подписанным release APK и не подходит как финальный канал обновления.

## API URL

`NOVA_API_BASE_URL` задаёт адрес backend. По умолчанию debug-клиент Android Emulator использует `http://10.0.2.2:3001`; локальный backend по проекту слушает порт `3001`. Для настоящего устройства или удалённого сервера задайте адрес доступный этому устройству. Разрешён незашифрованный HTTP только в debug варианте.

Release сборка требует публичный `https://` API URL и signing secrets, передаваемые только в CI: `NOVA_RELEASE_STORE_FILE`, `NOVA_RELEASE_STORE_PASSWORD`, `NOVA_RELEASE_KEY_ALIAS` и `NOVA_RELEASE_KEY_PASSWORD`. Никогда не храните эти значения в исходниках или APK. Сохраняйте тот же signing key и увеличивайте `versionCode` для обновлений.

Экран входа и чат работают через реальный REST/Socket.IO backend; успешная сборка сама по себе не доказывает доставку email OTP или end-to-end обмен сообщениями. До появления доступного backend и SMTP-провайдера UI должен показывать реальную ошибку, а не код/демо-успех.

## Оформление и профиль

Выбор темы, оттенка стекла и атмосферы сохраняется на устройстве. Сезон берётся
из локального календаря. Для погодного фона можно выбрать город в настройках.
Клиент передаёт введённое название и координаты выбранного города в
[Open-Meteo](https://open-meteo.com/en/docs). При недоступности погодных данных
сохраняется сезонный фон.

В настройках профиля системный выбор фото и видео поддерживает JPEG, PNG,
WebP, GIF, MP4 и WebM до 8 МБ. Нужна серверная миграция
`002_profile_media.sql`. GIF и анимированный WebP воспроизводятся на Android 9+
при включённых системных анимациях. Превью видео запускается по нажатию и без
звука.
