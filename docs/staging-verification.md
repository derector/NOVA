# NOVA — staging verification (2026-11-15)

This document records checks executed in the Manus Linux sandbox. It is evidence for a staging run, not a production readiness claim.

## Environment

- Ubuntu 24.04 aarch64, Node.js 22.23.4, Temurin JDK 21, Android SDK platform/build-tools 35.
- PostgreSQL 16 local cluster; database `nova`; migrations `001_initial.sql` applied.
- Local SMTP catcher on `127.0.0.1:1025` to exercise the real Nodemailer path without external credentials.
- API and web exposed through temporary HTTPS forwarding URLs while the sandbox is active. These URLs are not production hosting.

## Executed checks

| Check | Result |
|---|---|
| Backend `npm run typecheck`, `npm test`, `npm run build` | Passed; 5/5 unit tests |
| Web `npm run lint`, `npm run typecheck`, `npm run build` | Passed |
| Android `:app:assembleDebug :app:testDebugUnitTest` | Passed; 8/8 JVM unit tests |
| APK metadata | `io.nova.app`, versionCode 3, versionName 0.1.2, minSdk 26, targetSdk 35 |
| API E2E (`staging/e2e_test.py`) | 20/20 calls passed |
| Socket.IO `message:new` (`staging/realtime_test.js`) | 3/3 consecutive deliveries |
| Web UI login via OTP | Passed in cloud browser |
| Web UI search + direct chat + send | Passed; message shown as server-confirmed |

The API E2E covered: OTP request and verification for three accounts, profile update, refresh-token rotation (old token rejected), username search without email exposure, direct-chat creation, message send with `Idempotency-Key`, identical retry returning the same message, conflicting retry returning 409, non-member access returning 403, and chat lists for both participants.

## Realtime race fixed

`RealtimeGateway` previously authenticated the socket asynchronously in `handleConnection`. A client that emitted `chat:join` immediately after `connect` could reach the handler before `client.data.userId` was set and receive `Invalid chatId`. Authentication now runs in a Socket.IO middleware registered in `afterInit`, before the connection is accepted. The staging test reproduced the failure before the change and passed 3/3 after it.

## Not verified

- Installation and update on a physical Android device or emulator.
- Real Brevo SMTP delivery, sender/domain authentication, and deliverability.
- Public production backend, managed PostgreSQL, backups, monitoring, and TLS termination.
- Release signing keystore, GitHub Actions secrets, and a hosted CI run for the current commit.
- Web Push, media storage, groups, calls, and other post-MVP features.

## APK signing note

The APK built in this sandbox is signed by the sandbox's default Android debug certificate (`9d:11:48:...`), not by the previous NOVA stable debug keystore (`83:9C:E1:...`). It must not be distributed as an update over an app signed with the other key. The stable key decision is pending.
