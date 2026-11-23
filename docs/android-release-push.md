# Push-уведомления об обновлениях NOVA

Установленная сборка NOVA подписывается на публичную тему Firebase Cloud Messaging `nova-apk-updates`, если в сборке задан публичный манифест обновлений, на устройстве доступны Google Play Services и Android разрешает уведомления NOVA. Подписка не использует email, имя, ID аккаунта или содержимое чатов. Если пользователь отключает канал или разрешение, NOVA перестаёт показывать уведомления и отписывается при следующем открытии приложения.

FCM передаёт только тип события и номер версии. Получив сигнал, NOVA запускает короткую задачу WorkManager. Она загружает манифест по адресу из сборки, проверяет пакет, номер версии и сертификат установленного NOVA, затем показывает локальное системное уведомление. Скачивание APK и полная проверка файла и подписи выполняются по действию пользователя. Проверка в приложении и периодическая задача WorkManager доступны и на устройствах без Google Play Services. Android может отложить фоновые сообщения при экономии заряда. [Документация Firebase Cloud Messaging для Android](https://firebase.google.com/docs/cloud-messaging/android/get-started)

## Подключение Firebase к APK

1. Откройте Firebase Console, создайте или выберите проект NOVA и зарегистрируйте Android-приложение с пакетом `io.nova.app`. Для обновлений Google Analytics не требуется. [Подключение Firebase к Android](https://firebase.google.com/docs/android/setup)
2. Скачайте конфигурацию именно Android-приложения `google-services.json`. Для локальной тестовой сборки поместите её в `android/app/google-services.json` и задайте `NOVA_UPDATE_MANIFEST_URL`. Файл исключён из Git.
3. Для release-сборок добавьте в защищённый GitHub Environment `release` секрет `NOVA_FIREBASE_ANDROID_JSON_BASE64` с содержимым файла, закодированным в Base64. CI временно распакует файл при сборке. Android-конфигурация идентифицирует Firebase-проект. JSON учетной записи сервера, закрытый ключ APK и токен отправки в неё не входят.

## Права на отправку из GitHub Actions

В Google Cloud включите Firebase Cloud Messaging API в том же проекте, создайте отдельный service account для отправки и привяжите ему роль `roles/firebasecloudmessaging.admin` в Firebase-проекте. Для GitHub Actions настройте Workload Identity Federation с провайдером GitHub OIDC `https://token.actions.githubusercontent.com`. [Права Firebase Cloud Messaging](https://docs.cloud.google.com/iam/docs/roles-permissions/firebasecloudmessaging) · [Google Cloud Workload Identity Federation](https://github.com/google-github-actions/auth#preferred-direct-workload-identity-federation)

Для репозитория `derector/NOVA` и стандартной ветки `main` настройте ограничения провайдера. Если имя репозитория или ветки меняется, обновите условия.

- Отображение атрибутов `google.subject=assertion.sub,attribute.repository=assertion.repository`.
- Условие `assertion.repository == 'derector/NOVA' && assertion.ref == 'refs/heads/main' && assertion.sub == 'repo:derector/NOVA:environment:release' && assertion.workflow_ref == 'derector/NOVA/.github/workflows/android-release-push.yml@refs/heads/main'`.
- На service account выдайте `roles/iam.workloadIdentityUser` участнику `principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/attribute.repository/derector/NOVA`, подставив числовой номер Google Cloud проекта пула и имя пула.

В GitHub Environment `release` задайте также переменные:

| Переменная | Значение |
| --- | --- |
| `NOVA_FIREBASE_PROJECT_ID` | ID Firebase-проекта, куда зарегистрировано приложение |
| `NOVA_FCM_WORKLOAD_IDENTITY_PROVIDER` | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID` |
| `NOVA_FCM_SERVICE_ACCOUNT` | Email service account, которому разрешена отправка |
| `NOVA_UPDATE_MANIFEST_URL` | Публичный HTTPS-адрес опубликованного `latest.json` |
| `NOVA_RELEASE_CERT_SHA256` | SHA-256 сертификата постоянного release-ключа |

## Уведомление о релизе

Опубликуйте версионированный подписанный APK, затем соответствующий `latest.json`. Запустите workflow **Notify Android users of a published NOVA release** в стандартной ветке. Передайте `version_code` из манифеста. Workflow скачает опубликованный APK и проверит SHA-256, пакет, версию и подпись Android тем же кодом, что и сборка релиза. С выключенным `send` запрос проверяет сообщение в FCM. После успешного прогона включите `send`, чтобы отправить сигнал подписчикам. Workflow получает короткоживущий OAuth-токен через GitHub OIDC. Команда использует [FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api).

Проверяйте реальную доставку на более старой подписанной сборке с той же конфигурацией Firebase, включив уведомления и свернув приложение. Уведомление должно открыть NOVA и показать доступный релиз. После скачивания проверьте, что Android принимает его как обновление установленного пакета. Режим проверки FCM подтверждает настройки запроса, а доставку подтверждает тест на устройстве.
