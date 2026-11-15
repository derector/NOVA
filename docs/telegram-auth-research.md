# Telegram authentication research

Verified 15 November 2026 from official Telegram documentation.

## Current official flow

Telegram's current Log In With Telegram documentation says new integrations can use the Telegram Login library, native Android/iOS SDKs, or standard OpenID Connect. The web OIDC flow is Authorization Code with PKCE. BotFather supplies the Client ID and Client Secret, and Allowed URLs must be registered there. The server exchanges the code at `https://oauth.telegram.org/token`, then validates the signed ID token against Telegram's JWKS endpoint `https://oauth.telegram.org/.well-known/jwks.json`.

The backend must verify issuer `https://oauth.telegram.org`, audience equal to the Bot Client ID, expiry, signature and the nonce. Client Secret must remain server-side. The implementation must not put Telegram secrets in the browser or APK.

Telegram also documents native Android/iOS SDKs. The current NOVA first slice implements the web OIDC path; native Android sign-in requires a deep-link/callback contract and native SDK integration and is kept as a separate vertical slice rather than pretending the web button logs the APK in.

## Sources

- https://core.telegram.org/widgets/login — current Log In With Telegram, BotFather Allowed URLs, OIDC PKCE, token exchange and JWKS validation.
- https://core.telegram.org/api/auth — Telegram's native authorization API and constraints for third-party clients.
- https://github.com/vcode-sh/better-auth-telegram — MIT reference implementation showing Widget, Mini App and OIDC variants; not added as a runtime dependency because NOVA uses its existing NestJS session model.

## NOVA implementation rule

The visible Telegram action is a real action. If BotFather credentials are missing, the backend returns a clear configuration error and the UI keeps the current auth context. Once credentials and Allowed URLs are configured, the OIDC flow exchanges a one-time handoff for normal NOVA access/refresh tokens. Voice, video, file and story features require their own storage, notification and permission contracts before controls are exposed.
