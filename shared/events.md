# NOVA Core Realtime Events (v0.1)

Backend is the system of record. Messages are persisted through REST before being broadcast. Socket events are for realtime updates, not durable offline delivery.

## Connection and authorization

- Transport: Socket.IO Engine.IO protocol, namespace `/`, endpoint `/socket.io/`, HTTPS/WSS in deployment.
- Client authenticates with `auth: { token: <short-lived access token> }`. The server validates the token at connection and authorizes each chat action against current membership.
- A client requests access with `chat:join` `{ chatId }`; success is acknowledged only after membership is checked. The server never permits arbitrary room joins.
- On reconnect, the client refreshes its session if needed, rejoins authorized chats, then fetches REST messages using `after=<last server message id>`.

## Events

### Client to server

`chat:join`

```json
{"chatId":"uuid"}
```

`chat:leave`

```json
{"chatId":"uuid"}
```

The authoritative create/send operation is REST `POST /api/v1/chats/{chatId}/messages` with `Idempotency-Key`. This gives an explicit HTTP response containing the server acknowledgement and allows WorkManager retry.

### Server to client

`chat:new` is sent to the authenticated sockets of both participants after a direct chat first commits. Clients refresh their chat list, then join the new chat and catch up through REST. Existing chats do not emit this event again.

```json
{"chatId":"uuid"}
```

`message:new`

```json
{
  "id":"server-uuid",
  "clientMessageId":"client-uuid",
  "chatId":"uuid",
  "senderId":"uuid",
  "text":"...",
  "createdAt":"ISO-8601 UTC"
}
```

`notification:new` may later contain only an opaque resource identifier and event type; sensitive message content is excluded by default.

### Direct call signaling

`call:ready` advertises media capability on the authenticated connection. `{}` enables both audio and video. `{ "audioOnly": true }` enables audio. `call:start` accepts `{ chatId, kind }`, where `kind` is `audio` or `video`. Only compatible clients of the other chat member receive `call:invite`.

`call:accept` and `call:end` accept `{ callId }`. Call invitation, acceptance and teardown are scoped to the authenticated participants. After acceptance, `call:signal` relays a description or ICE candidate only between the two selected sockets. The first accepted client wins and other compatible devices receive `call:dismissed`.

### Acknowledgements and errors

- REST 201 is the server acknowledgement; a client must not mark a message delivered before receiving it.
- Acknowledged Socket.IO actions include a structured error on failure. Acknowledged call actions include `call:ready`, `call:start`, `call:accept` and `call:signal`.
- Server events are idempotently merged by `id` and `clientMessageId`; repeated events must not duplicate the local row.
- Reconnect catch-up uses REST cursor pagination. Socket delivery alone does not guarantee replay after disconnect.
