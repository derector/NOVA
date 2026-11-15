# Вход NOVA: сеть, форма и email OTP

## Почему телефон показывает «Нет соединения с сервером»

Debug-сборка NOVA по умолчанию настроена на `http://10.0.2.2:3001`. Android описывает `10.0.2.2` как адрес host loopback, доступный **из Android Emulator**; сетевой адрес физического устройства отличается. Поэтому Xiaomi пытается обратиться не к NOVA API: запрос не доходит до backend, и email-код не отправляется. [1]

В Android manifest есть `INTERNET`; debug build разрешает HTTP, а release запрещает cleartext. Значит, для показанного debug APK основная проблема — недоступный на телефоне API host, а не permission. Android рекомендует защищённое соединение; здесь HTTP допустим только для отладки, а production endpoint должен использовать HTTPS. [7]

Для локального теста на физическом телефоне backend должен работать на компьютере и быть доступен по его LAN IP, например `http://<IP-компьютера>:3001`; телефон и компьютер должны быть в одной Wi-Fi-сети, а firewall должен пропускать порт. В проекте NestJS слушает `0.0.0.0:3001`. Это только временный developer setup. Для обычного использования нужны доступный телефону HTTPS backend, PostgreSQL и настроенная доставка email.

## Форма входа

Руководство Jetpack Compose описывает отдельную настройку типа клавиатуры и IME-действия, включая выполнение действия при нажатии кнопки экранной клавиатуры. Документация Compose по window insets объясняет, как реагировать на экранную клавиатуру и не перекрывать поле ввода. [2] [3]

В репозитории Google [`android/compose-samples`](https://github.com/android/compose-samples) экран Jetchat демонстрирует Compose state, ввод, focus management и `imePadding`. Репозиторий CVS Health показывает accessibility-подход к label, keyboard type/action, пояснению и ошибочному состоянию TextField. В NOVA приняты соответствующие нативные Compose patterns, а не код/зависимость из этих репозиториев. [4] [5]

В v0.1.2 реализованы email validation до запроса, Email keyboard, action «Готово», очистка и смена email, отдельный цифровой ввод OTP, прокручиваемая форма с учётом IME и понятное сообщение, если debug APK обращается к `10.0.2.2` с физического телефона. При недоступном API экран не сообщает, что письмо отправлено.

## Можно ли отправлять коды через Brevo

Да. Backend уже использует Nodemailer и стандартный SMTP transport, а Brevo официально поддерживает транзакционные письма через SMTP relay; новый провайдерский SDK не требуется. [8] Для Brevo задаются `SMTP_HOST=smtp-relay.brevo.com`, порт `587`, `SMTP_SECURE=false`, точный SMTP login из страницы Brevo SMTP settings и **SMTP key**, а не API key. На порту 587 Nodemailer использует STARTTLS; в backend для портов 587/2525 теперь требуется TLS upgrade. [8] [9] [10] [13]

`SMTP_FROM` должен быть настроенным sender в Brevo. Brevo рекомендует сначала аутентифицировать собственный домен и настроить DKIM/DMARC; адреса бесплатных почтовых доменов вроде Gmail нельзя аутентифицировать как собственный домен отправителя. SMTP key показывается при создании только один раз и должен храниться только в защищённом backend secret store, не в APK, открытом GitHub или чате. [8] [9] [11] [12]

Brevo решит доставку только после настройки аккаунта/sender/credentials **и** размещения backend на адресе, доступном телефону. Один лишь SMTP provider не делает `10.0.2.2` доступным физическому телефону и не размещает API или PostgreSQL.

## Источники

[1]: https://developer.android.com/studio/run/emulator-networking-address "Адреса сети Android Emulator"
[2]: https://developer.android.com/develop/ui/compose/text/user-input "Ввод текста в Jetpack Compose"
[3]: https://developer.android.com/develop/ui/compose/layouts/insets "Window insets в Jetpack Compose"
[4]: https://github.com/android/compose-samples/blob/main/Jetchat/app/src/main/java/com/example/compose/jetchat/conversation/UserInput.kt "Google Jetchat Compose sample UserInput"
[5]: https://github.com/cvs-health/android-compose-accessibility-techniques/blob/main/doc/components/TextFieldControls.md "CVS Health accessibility techniques for Compose TextField"
[7]: https://developer.android.com/privacy-and-security/security-config "Android Network Security Configuration"
[8]: https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP "Brevo SMTP transactional email guide"
[9]: https://help.brevo.com/hc/en-us/articles/7959631848850-Create-and-manage-your-SMTP-keys "Brevo SMTP keys"
[10]: https://help.brevo.com/hc/en-us/articles/10905415650322-Which-SMTP-port-should-I-use-Port-587-465-or-2525 "Brevo SMTP ports"
[11]: https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender "Brevo sender setup"
[12]: https://help.brevo.com/hc/en-us/articles/208848209-Authenticate-your-domain-to-improve-the-deliverability-of-your-emails-DKIM "Brevo domain authentication"
[13]: https://nodemailer.com/smtp "Nodemailer SMTP transport and TLS"
