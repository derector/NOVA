# NOVA UI, resilience and Telegram sign-in plan

## Product direction

NOVA is a calm, privacy-aware messenger with a dark navy base, mint accent and direct, readable interaction. The first action on auth is to enter NOVA; the primary trust signal is a clear connection state, not decorative noise. Telegram is an optional identity provider that must use Telegram's current OIDC Authorization Code Flow with PKCE and server-side ID-token verification.

## Style decision

- **Chosen movement:** calm expressive utility — a Telegram-like messaging density with NOVA's own navy/mint identity.
- **Core principles:** one clear action per surface; real state over decoration; generous touch targets; motion explains state changes; errors preserve context and provide retry.
- **Color philosophy:** `#101722` anchors focus; `#70E1C1` marks available action and healthy connection; warm error surfaces are distinct without relying on color alone.
- **Layout paradigm:** staged auth and profile setup on a single vertical flow; two-pane desktop chat, stacked mobile chat; settings and connection actions stay close to the account surface.
- **Signature elements:** N mark, mint focus rail, compact connection pill, message bubbles with explicit delivery state.
- **Interaction and animation:** 160–240ms state transitions, 280ms modal/panel entry, no infinite decorative animation, `prefers-reduced-motion` and Android system reduced-motion respected.
- **Typography:** platform/system sans; headline weight creates hierarchy, body text remains readable at large scale. No third-party font asset is added.
- **Brand voice:** direct and reassuring. Example: “Войдите без пароля” and “Соединение восстановлено — можно продолжать.”

## Implementation scope

1. Make API and client errors distinguish a stopped/tunnel backend from SMTP configuration. The input and current auth step must remain intact after 502/503.
2. Replace ad-hoc web violet tokens with NOVA semantic navy/mint tokens while keeping platform-appropriate layouts and visible focus.
3. Improve Android auth/profile/chat surfaces with shared tokens, explicit loading/error/retry states, 48dp targets, IME-safe scrolling and restrained Compose motion.
4. Add Telegram OIDC backend endpoints: start, callback and one-time exchange. Sign-in uses BotFather client credentials, registered redirect URI, PKCE state and server-side JWKS validation (`iss`, `aud`, `exp`). Telegram secrets never reach browser or APK.
5. Add a real “Войти через Telegram” / “Подключить Telegram” action to web auth and account surface. When env is absent, explain configuration is required instead of presenting a fake success.
6. Do not add voice notes, video circles or calls as non-functional UI. Their implementation requires media upload/retention, WebRTC signaling, STUN/TURN and permissions; document them as next scope.

## Files and boundaries

- `backend/src/auth/*`, `backend/migrations/*`: Telegram OIDC and handoff/session identity.
- `web/src/app/page.tsx`, `web/src/app/globals.css`, `web/src/lib/api.ts`: auth UI, connection/retry states, semantic design tokens.
- `android/app/src/main/java/io/nova/app/ui/*`: native Compose UI only; no WebView or Expo.
- `docs/design.md`: approved semantic design contract and known gaps.

## External material

Official Telegram Login documentation is the source of truth. Do not copy third-party Telegram UI assets or add a library without checking its license and fit. The existing NOVA local skills are adaptations, not runtime dependencies.
