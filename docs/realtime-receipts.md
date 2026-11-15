# NOVA realtime messaging — implemented slice

## Real behavior

NOVA text messages are persisted in PostgreSQL with an idempotency key, returned from the API only after commit, and broadcast over authenticated Socket.IO. The existing staging E2E already verifies two accounts, personal chat, message persistence, catch-up and `message:new` delivery.

This iteration adds:

- `message_receipts` storage keyed by `(message_id, user_id)` with `delivered_at` and `read_at`.
- `POST /api/v1/chats/:chatId/read`, which marks all incoming messages in the opened chat as delivered/read and returns the affected message IDs.
- `message:read` Socket.IO event so the sender can update the outgoing message state.
- `notification:new` in-app realtime event for a message arriving outside the selected chat.
- Web UI states: saved, delivered and read (`✓`, `✓✓`) rather than a decorative status.
- Web UI in-app notice for a message in another dialog.

## Verification

- Backend typecheck: passed.
- Backend unit tests: 5/5 passed.
- Backend build: passed.
- Migration `003_message_receipts.sql`: applied to staging PostgreSQL.
- Staging check: Bob marked the E2E chat read with HTTP 200; Alice's subsequent message history included non-null `readAt` and `deliveredAt`.
- Web lint/typecheck/build: passed.

## Boundaries

`notification:new` is an in-app/WebSocket notification. OS push notifications require FCM/APNs credentials, device-token storage, a background worker and delivery policy; they are not claimed complete. Media, files, stories and calls require their own storage/retention, permissions, upload/download, WebRTC signaling and TURN/SFU contracts before controls are exposed.
