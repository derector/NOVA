# NOVA Design Contract

## Mission

NOVA is a focused private messenger for direct conversations. Authentication should feel quick and trustworthy; the chat should make delivery, connectivity and recovery obvious without imitating another brand.

## Foundations

- Base: `#101722`; panel: `#182230`; accent: `#70E1C1`; accent text: `#05251D`.
- Semantic roles: `surface.canvas`, `surface.panel`, `content.primary`, `content.muted`, `action.primary`, `status.success`, `status.error`, `status.offline`.
- Rhythm: 4/8 spacing scale. Android interactive targets are at least 48dp; web controls are at least 44px where practical.
- Corners: 12px/16px/24px based on control, list item and card roles. Avoid mixing unrelated radius systems.
- Typography: system sans; one headline scale, one body scale and explicit supporting text. Russian long strings must wrap.
- Brand: existing N mark only. No copied Telegram logo or third-party fonts/assets.

## Component contracts

### Auth card

An auth card has a single primary action, preserved input, an optional secondary Telegram action, a visible loading state, a recoverable error and a connection/configuration explanation. HTTP 502/503 must not erase email or OTP input. Telegram sign-in is only successful after backend token verification.

### Connection status

Show online/offline and realtime state with text plus a visual indicator. A stopped backend, unavailable SMTP and offline browser are different messages with different next actions.

### Chat row and bubble

Chat rows show participant identity, username and last activity. Bubbles show time and explicit sending/failed state; failed messages retain retry. Do not show media, calls or recording controls until their server/media contracts exist.

### Telegram connection

The button is present only as a real action. If Telegram credentials are not configured, it opens a configuration explanation rather than a fake popup. The backend owns client secret, PKCE exchange, JWKS validation and account linking.

## Motion

- Auth step/panel: 220–280ms ease-out.
- Button loading: stable label with inline progress, no layout jump.
- Chat list updates: 160ms fade/translate; no infinite decorative loops.
- Reduced motion: remove transform/scale and use opacity or immediate state changes.

## Accessibility and QA

Use semantic labels, visible focus, Escape for modals, keyboard submit, `contentDescription` in Compose, and readable error text. Verify narrow web width, keyboard/IME, large text, offline/retry and both auth steps. Device/emulator visual verification and production SMTP/Telegram credentials remain environment-dependent.

## Planned, not implemented

Voice recordings, video circles and calls require persistent media storage, upload/download lifecycle, permissions, WebRTC signaling, STUN/TURN and operational monitoring. They must be implemented as real vertical slices before their controls appear in the product.

## Provenance

The visual rules are a NOVA adaptation of the project-local Taste, UI/UX, Motion and DESIGN references. Official Telegram OIDC behavior is based on [Telegram Log In With Telegram](https://core.telegram.org/widgets/login). No third-party runtime UI or brand asset is included.
