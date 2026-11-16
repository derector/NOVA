'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_URL, apiFetch, apiPath, NovaApiError } from '@/lib/api';
import type { AuthTokens, MessagePage, NovaChat, NovaMessage, NovaPublicUser, NovaUser } from '@/lib/types';

type Screen = 'email' | 'verify' | 'profile' | 'app';
type SocketState = 'connecting' | 'connected' | 'disconnected';
type PresenceState = { status: 'online' | 'offline'; lastSeenAt: string | null };
const REFRESH_TOKEN_KEY = 'nova.refreshToken';

function Icon({ name, size = 20 }: { name: 'spark' | 'search' | 'plus' | 'send' | 'logout' | 'back' | 'message' | 'arrow'; size?: number }) {
  const paths: Record<typeof name, React.ReactNode> = {
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    send: <><path d="m21 3-7.2 18-3.5-7.3L3 10.2 21 3Z" /><path d="M10.3 13.7 21 3" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    back: <><path d="m15 18-6-6 6-6" /><path d="M9 12h12" /></>,
    message: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand${compact ? ' brand-compact' : ''}`} aria-label="NOVA">
    <span className="brand-mark"><Icon name="spark" size={21} /></span>
    <span className="brand-word">NOVA<span className="brand-period">.</span></span>
  </div>;
}

function Notice({ children, tone = 'error', onClose }: { children: React.ReactNode; tone?: 'error' | 'success' | 'info'; onClose?: () => void }) {
  return <div className={`notice notice-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
    <span className="notice-dot" aria-hidden="true" />
    <div className="notice-copy">{children}</div>
    {onClose && <button className="notice-close" type="button" aria-label="Закрыть уведомление" onClick={onClose}>×</button>}
  </div>;
}

function humanDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function mergeMessages(current: NovaMessage[], incoming: NovaMessage[]): NovaMessage[] {
  const merged = [...current];
  for (const message of incoming) {
    const index = merged.findIndex((item) => item.id === message.id || item.clientMessageId === message.clientMessageId);
    if (index >= 0) merged[index] = { ...merged[index], ...message };
    else merged.push(message);
  }
  return merged.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

function newestMessage(items: NovaMessage[]): NovaMessage | undefined {
  return [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Не удалось выполнить запрос. Попробуйте ещё раз.';
}

function isNovaChat(value: unknown): value is NovaChat {
  if (!value || typeof value !== 'object') return false;
  const chat = value as Partial<NovaChat>;
  return typeof chat.id === 'string' && Boolean(chat.participant && typeof chat.participant.id === 'string');
}

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [accessExpiresAt, setAccessExpiresAt] = useState<string | null>(null);
  const [me, setMe] = useState<NovaUser | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [telegramBusy, setTelegramBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [success, setSuccess] = useState('');
  const [online, setOnline] = useState(true);
  const [socketState, setSocketState] = useState<SocketState>('connecting');
  const [chats, setChats] = useState<NovaChat[]>([]);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<NovaMessage[]>([]);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [messagesLoadError, setMessagesLoadError] = useState('');
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [mutatingMessageId, setMutatingMessageId] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<NovaPublicUser[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [chatBusyUserId, setChatBusyUserId] = useState<string | null>(null);
  const [presenceByUser, setPresenceByUser] = useState<Record<string, PresenceState>>({});
  const [typingUserId, setTypingUserId] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const chatsRef = useRef<NovaChat[]>([]);
  const selectedChatRef = useRef<string | null>(null);
  const messagesRef = useRef<NovaMessage[]>([]);
  const cursorRef = useRef<Record<string, string>>({});
  const refreshInFlight = useRef<Promise<string> | null>(null);
  const pendingSendRef = useRef<{ text: string; key: string } | null>(null);
  const typingTimerRef = useRef<number | null>(null);

  useEffect(() => { chatsRef.current = chats; }, [chats]);
  useEffect(() => { selectedChatRef.current = selectedChatId; }, [selectedChatId]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const saveTokens = useCallback((tokens: AuthTokens) => {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    setAccessToken(tokens.accessToken);
    setAccessExpiresAt(tokens.accessTokenExpiresAt);
    setMe(tokens.user);
    setEmail(tokens.user.email);
    setUsername(tokens.user.username || '');
    setDisplayName(tokens.user.displayName || '');
    setChats([]);
    setChatsLoaded(false);
    setMessages([]);
    setSocketState('connecting');
    setNotice('');
    setSuccess('');
    setScreen(!tokens.user.username || !tokens.user.displayName ? 'profile' : 'app');
    setPresenceByUser({});
    setTypingUserId(null);
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const refreshToken = window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) throw new NovaApiError({ status: 401, message: 'Сессия завершена. Войдите по email.' });

    const refreshPromise = apiFetch<Omit<AuthTokens, 'user'> & { user?: NovaUser }>(apiPath('/auth/refresh'), {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }).then((tokens) => {
      if (!tokens.accessToken || !tokens.refreshToken || !tokens.accessTokenExpiresAt) {
        throw new Error('Backend вернул неполный ответ обновления сессии.');
      }
      window.sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      setAccessToken(tokens.accessToken);
      setAccessExpiresAt(tokens.accessTokenExpiresAt);
      setSocketState('connecting');
      return tokens.accessToken;
    }).catch((error: unknown) => {
      if (error instanceof NovaApiError && error.status === 401) {
        window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
        setAccessToken(null);
        setMe(null);
        setScreen('email');
      }
      throw error;
    }).finally(() => {
      refreshInFlight.current = null;
    });
    refreshInFlight.current = refreshPromise;
    return refreshPromise;
  }, []);

  const authenticatedFetch = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    if (!accessToken) throw new NovaApiError({ status: 401, message: 'Войдите, чтобы продолжить.' });
    try {
      return await apiFetch<T>(path, options, accessToken);
    } catch (error) {
      if (!(error instanceof NovaApiError) || error.status !== 401) throw error;
      const nextToken = await refreshAccessToken();
      return apiFetch<T>(path, options, nextToken);
    }
  }, [accessToken, refreshAccessToken]);

  const clearSession = useCallback(async () => {
    const currentToken = accessToken;
    try {
      if (currentToken) await apiFetch<void>(apiPath('/auth/logout'), { method: 'POST' }, currentToken);
    } catch {
      // Clear local credentials even if the server is offline; the refresh token is not retained.
    }
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    socketRef.current?.disconnect();
    socketRef.current = null;
    setAccessToken(null);
    setAccessExpiresAt(null);
    setMe(null);
    setChats([]);
    setChatsLoaded(false);
    setMessages([]);
    setLoadingChatId(null);
    setSelectedChatId(null);
    setSocketState('connecting');
    setPresenceByUser({});
    setTypingUserId(null);
    setScreen('email');
    setNotice('');
    setSuccess('');
  }, [accessToken]);

  useEffect(() => {
    const refreshToken = window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) return;
    let active = true;
    apiFetch<Omit<AuthTokens, 'user'> & { user?: NovaUser }>(apiPath('/auth/refresh'), {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }).then(async (tokens) => {
      if (!tokens.accessToken || !tokens.refreshToken || !tokens.accessTokenExpiresAt) throw new Error('Некорректный ответ обновления сессии.');
      window.sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      const user = await apiFetch<NovaUser>(apiPath('/users/me'), {}, tokens.accessToken);
      if (!active) return;
      saveTokens({ ...tokens, user });
    }).catch((error: unknown) => {
      if (error instanceof NovaApiError && error.status === 401) {
        window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
      }
      if (active) {
        if (!(error instanceof NovaApiError && error.status === 401)) {
          setNotice(`Не удалось восстановить сессию: ${getErrorMessage(error)}`);
        }
      }
    });
    return () => { active = false; };
  }, [saveTokens]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const handoff = params.get('telegram_handoff');
    const telegramError = params.get('telegram_error');
    if (telegramError) window.setTimeout(() => setNotice(`Telegram: ${telegramError}`), 0);
    if (!handoff) return;
    window.history.replaceState({}, '', window.location.pathname);
    window.setTimeout(() => setTelegramBusy(true), 0);
    apiFetch<AuthTokens>(apiPath('/auth/telegram/exchange'), { method: 'POST', body: JSON.stringify({ handoff }) })
      .then((tokens) => {
        if (!tokens.accessToken || !tokens.refreshToken || !tokens.accessTokenExpiresAt || !tokens.user) throw new Error('Backend вернул неполный ответ Telegram-авторизации.');
        saveTokens(tokens);
      })
      .catch((error: unknown) => setNotice(getErrorMessage(error)))
      .finally(() => setTelegramBusy(false));
  }, [saveTokens]);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    updateOnline();
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    if (screen !== 'app') return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const typing = target instanceof HTMLElement && (
        target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
      );
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        setSearchOpen(true);
        setSearchError('');
      } else if (event.key === 'Escape') {
        setSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen]);

  useEffect(() => {
    if (!accessToken || !accessExpiresAt || !['app', 'profile'].includes(screen)) return;
    const expiry = Date.parse(accessExpiresAt);
    if (Number.isNaN(expiry)) return;
    const refreshDelay = Math.max(expiry - Date.now() - 30_000, 1_000);
    const timer = window.setTimeout(() => {
      void refreshAccessToken().catch((error: unknown) => {
        setNotice(`Не удалось обновить сессию: ${getErrorMessage(error)}`);
      });
    }, refreshDelay);
    return () => window.clearTimeout(timer);
  }, [accessToken, accessExpiresAt, screen, refreshAccessToken]);

  useEffect(() => {
    if (screen !== 'app' || !accessToken) return;
    let active = true;
    authenticatedFetch<NovaChat[]>(apiPath('/chats')).then((items) => {
      if (!active) return;
      setChats(items);
      chatsRef.current = items;
      setChatsLoaded(true);
      setNotice('');
    }).catch((error: unknown) => {
      if (active) {
        setChatsLoaded(true);
        setNotice(getErrorMessage(error));
      }
    });
    return () => { active = false; };
  }, [screen, accessToken, authenticatedFetch]);

  const catchUpChat = useCallback(async (chatId: string) => {
    let cursor = cursorRef.current[chatId];
    for (let pageNumber = 0; pageNumber < 20; pageNumber += 1) {
      const query = new URLSearchParams({ limit: '100' });
      if (cursor) query.set('after', cursor);
      const page = await authenticatedFetch<MessagePage>(apiPath(`/chats/${chatId}/messages?${query.toString()}`));
      if (page.items.length) {
        setMessages((current) => selectedChatRef.current === chatId ? mergeMessages(current, page.items) : current);
        const newest = newestMessage(page.items);
        const nextCursor = page.nextCursor || newest?.id;
        if (!nextCursor || nextCursor === cursor) break;
        cursor = nextCursor;
        cursorRef.current[chatId] = cursor;
        if (page.items.length < 100 && !page.nextCursor) break;
      } else {
        break;
      }
    }
  }, [authenticatedFetch]);

  useEffect(() => {
    if (screen !== 'app' || !accessToken) return;
    const socket = io(API_BASE_URL, {
      path: '/socket.io/',
      autoConnect: false,
      auth: { token: accessToken },
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;
    let refreshingSocket = false;

    socket.on('connect', () => {
      setSocketState('connected');
      socket.emit('presence:heartbeat');
      chatsRef.current.forEach((chat) => {
        socket.emit('chat:join', { chatId: chat.id }, (ack?: { error?: { message?: string } }) => {
          if (ack?.error?.message) setNotice(`Не удалось подключиться к диалогу: ${ack.error.message}`);
        });
      });
      const activeChat = selectedChatRef.current;
      if (activeChat) void catchUpChat(activeChat).catch((error: unknown) => setNotice(`Не удалось восстановить историю после подключения: ${getErrorMessage(error)}`));
    });
    socket.on('disconnect', () => setSocketState('disconnected'));
    const heartbeat = window.setInterval(() => {
      if (socket.connected) socket.emit('presence:heartbeat');
    }, 30_000);
    socket.on('connect_error', (error: Error) => {
      setSocketState('disconnected');
      if (refreshingSocket || !/auth|token|unauthorized|expired|jwt/i.test(error.message)) return;
      refreshingSocket = true;
      void refreshAccessToken().then((nextToken) => {
        socket.auth = { token: nextToken };
        socket.disconnect();
        socket.connect();
      }).catch((refreshError: unknown) => {
        setNotice(`Не удалось обновить сессию для realtime: ${getErrorMessage(refreshError)}`);
      }).finally(() => { refreshingSocket = false; });
    });
    socket.on('message:new', (message: NovaMessage) => {
      if (!message || typeof message.id !== 'string' || typeof message.chatId !== 'string') return;
      if (message.chatId === selectedChatRef.current) {
        setMessages((current) => mergeMessages(current, [message]));
      }
      const previousCursor = cursorRef.current[message.chatId];
      const existing = messagesRef.current.find((item) => item.chatId === message.chatId);
      if (!previousCursor || !existing || Date.parse(message.createdAt) >= Date.parse(existing.createdAt)) {
        cursorRef.current[message.chatId] = message.id;
      }
      setChats((current) => current.map((chat) => chat.id === message.chatId
        ? { ...chat, updatedAt: message.createdAt }
        : chat).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
    });
    socket.on('notification:new', (notification: { type?: string; chatId?: string }) => {
      const chat = notification.chatId ? chatsRef.current.find((item) => item.id === notification.chatId) : undefined;
      const muted = Boolean(chat?.mutedUntil && Date.parse(chat.mutedUntil) > Date.now());
      if (notification?.type === 'message' && notification.chatId && notification.chatId !== selectedChatRef.current && !muted) {
        setNotice('Новое сообщение в другом диалоге.');
      }
    });
    socket.on('message:read', (event: { chatId?: string; messageIds?: string[] }) => {
      if (!event?.chatId || !Array.isArray(event.messageIds) || event.chatId !== selectedChatRef.current) return;
      const ids = new Set(event.messageIds);
      const readAt = new Date().toISOString();
      setMessages((current) => current.map((message) => ids.has(message.id) ? { ...message, deliveredAt: message.deliveredAt || readAt, readAt } : message));
    });
    socket.on('message:updated', (message: NovaMessage) => {
      if (message?.chatId === selectedChatRef.current) setMessages((current) => mergeMessages(current, [message]));
    });
    socket.on('message:deleted', (message: NovaMessage) => {
      if (message?.chatId === selectedChatRef.current) setMessages((current) => mergeMessages(current, [message]));
    });
    socket.on('presence:update', (event: { userId?: string; status?: 'online' | 'offline'; lastSeenAt?: string | null }) => {
      if (!event?.userId || (event.status !== 'online' && event.status !== 'offline')) return;
      setPresenceByUser((current) => ({ ...current, [event.userId as string]: { status: event.status as 'online' | 'offline', lastSeenAt: event.lastSeenAt ?? null } }));
    });
    socket.on('typing:update', (event: { chatId?: string; userId?: string; isTyping?: boolean }) => {
      if (event?.chatId !== selectedChatRef.current || !event.userId) return;
      setTypingUserId(event.isTyping ? event.userId : null);
    });
    socket.connect();
    return () => {
      window.clearInterval(heartbeat);
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [screen, accessToken, catchUpChat, refreshAccessToken]);

  const emitTyping = useCallback((isTyping: boolean) => {
    if (!selectedChatId || !socketRef.current?.connected) return;
    socketRef.current.emit('typing:set', { chatId: selectedChatId, isTyping });
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    if (isTyping) {
      typingTimerRef.current = window.setTimeout(() => {
        socketRef.current?.emit('typing:set', { chatId: selectedChatId, isTyping: false });
      }, 4_000);
    }
  }, [selectedChatId]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    chats.forEach((chat) => {
      socket.emit('chat:join', { chatId: chat.id }, (ack?: { error?: { message?: string } }) => {
        if (ack?.error?.message) setNotice(`Не удалось подключиться к диалогу: ${ack.error.message}`);
      });
    });
  }, [chats]);

  useEffect(() => {
    if (!selectedChatId || !accessToken || screen !== 'app') return;
    let active = true;
    authenticatedFetch<MessagePage>(apiPath(`/chats/${selectedChatId}/messages?limit=100`)).then((page) => {
      if (!active) return;
      const items = mergeMessages([], page.items);
      setMessages(items);
      setLoadingChatId(null);
      setMessagesLoadError('');
      void authenticatedFetch<{ chatId: string; messageIds: string[] }>(apiPath(`/chats/${selectedChatId}/read`), { method: 'POST' })
        .catch((error: unknown) => setNotice(`Не удалось подтвердить прочтение: ${getErrorMessage(error)}`));
      setChats((current) => current.map((chat) => chat.id === selectedChatId ? { ...chat, unreadCount: 0 } : chat));
      const newest = newestMessage(items);
      if (newest) cursorRef.current[selectedChatId] = newest.id;
      setNotice('');
      void catchUpChat(selectedChatId).catch((error: unknown) => setNotice(`Не удалось восстановить новые сообщения: ${getErrorMessage(error)}`));
    }).catch((error: unknown) => {
      if (active) {
        setLoadingChatId(null);
        setMessagesLoadError(getErrorMessage(error));
        setNotice(getErrorMessage(error));
      }
    });
    const socket = socketRef.current;
    if (socket?.connected) socket.emit('chat:join', { chatId: selectedChatId });
    return () => {
      active = false;
      if (socket?.connected) socket.emit('chat:leave', { chatId: selectedChatId });
    };
  }, [selectedChatId, accessToken, screen, authenticatedFetch, historyAttempt, catchUpChat]);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    setSuccess('');
    try {
      await apiFetch<void>(apiPath('/auth/request-code'), { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
      setScreen('verify');
      setSuccess(`Если адрес ${email.trim()} может использовать NOVA, письмо с кодом отправлено.`);
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally { setBusy(false); }
  }

  async function startTelegram() {
    setTelegramBusy(true);
    setNotice('');
    try {
      const result = await apiFetch<{ url: string }>(apiPath('/auth/telegram/start'));
      if (!result.url.startsWith('https://oauth.telegram.org/auth?')) throw new Error('Backend вернул небезопасный Telegram URL.');
      window.location.assign(result.url);
    } catch (error) {
      setNotice(getErrorMessage(error));
      setTelegramBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    try {
      const tokens = await apiFetch<AuthTokens>(apiPath('/auth/verify-code'), {
        method: 'POST', body: JSON.stringify({ email: email.trim(), code: code.trim() }),
      });
      if (!tokens.accessToken || !tokens.refreshToken || !tokens.accessTokenExpiresAt || !tokens.user) {
        throw new Error('Backend вернул неполный ответ авторизации.');
      }
      saveTokens(tokens);
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally { setBusy(false); }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    setSuccess('');
    try {
      await authenticatedFetch<unknown>(apiPath('/users/me'), {
        method: 'PATCH', body: JSON.stringify({ username: username.trim(), displayName: displayName.trim() }),
      });
      const updated = await authenticatedFetch<NovaUser>(apiPath('/users/me'));
      if (!updated || typeof updated.id !== 'string' || typeof updated.username !== 'string' || typeof updated.displayName !== 'string') {
        throw new Error('Backend сохранил профиль, но GET /users/me вернул данные в неожиданном формате.');
      }
      setMe(updated);
      setUsername(updated.username);
      setDisplayName(updated.displayName);
      setScreen('app');
      setSuccess('Профиль сохранён. Теперь можно найти второго пользователя по username.');
    } catch (error) { setNotice(getErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function searchUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = searchTerm.trim().replace(/^@/, '');
    if (!term) {
      setSearchError('Введите username для поиска.');
      setSearchResults([]);
      return;
    }
    setSearchBusy(true);
    setSearchError('');
    setSearchResults([]);
    try {
      const results = await authenticatedFetch<NovaPublicUser[]>(`${apiPath('/users/search')}?${new URLSearchParams({ username: term })}`);
      if (!Array.isArray(results)) throw new Error('Backend вернул результаты поиска в неожиданном формате.');
      setSearchResults(results);
      if (!results.length) setSearchError('Пользователь с таким username не найден. Проверьте написание.');
    } catch (error) { setSearchError(getErrorMessage(error)); }
    finally { setSearchBusy(false); }
  }

  async function startDirectChat(user: NovaPublicUser) {
    if (user.id === me?.id) return;
    setChatBusyUserId(user.id);
    setSearchError('');
    try {
      const result = await authenticatedFetch<unknown>(apiPath('/chats/direct'), {
        method: 'POST', body: JSON.stringify({ userId: user.id }),
      });
      const wrappedChat = result && typeof result === 'object' && 'chat' in result
        ? (result as { chat?: unknown }).chat
        : result;
      let chat = isNovaChat(wrappedChat) ? wrappedChat : null;
      if (!chat) {
        const currentChats = await authenticatedFetch<NovaChat[]>(apiPath('/chats'));
        if (Array.isArray(currentChats)) {
          setChats(currentChats);
          chatsRef.current = currentChats;
          chat = currentChats.find((item) => item.participant?.id === user.id) || null;
        }
      }
      if (!chat) {
        throw new Error('Backend вернул неполный direct-chat response. Диалог не показан, чтобы не подменять серверные данные.');
      }
      setChats((current) => [chat, ...current.filter((item) => item.id !== chat.id)]);
      setMessages([]);
      setMessagesLoadError('');
      setLoadingChatId(chat.id);
      setSelectedChatId(chat.id);
      setSearchOpen(false);
      setSearchResults([]);
      setSearchTerm('');
      setSuccess(`Открыт личный диалог с @${user.username}.`);
    } catch (error) { setSearchError(getErrorMessage(error)); }
    finally { setChatBusyUserId(null); }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!selectedChatId || !text || sending) return;
    if (!online) {
      setNotice('Нет подключения к сети. Сообщение не отправлено — подключитесь и повторите попытку.');
      return;
    }
    setSending(true);
    setNotice('');
    try {
      const clientMessageId = pendingSendRef.current?.text === text
        ? pendingSendRef.current.key
        : crypto.randomUUID();
      pendingSendRef.current = { text, key: clientMessageId };
      const message = await authenticatedFetch<NovaMessage>(apiPath(`/chats/${selectedChatId}/messages`), {
        method: 'POST',
        headers: { 'Idempotency-Key': clientMessageId },
        body: JSON.stringify({ text }),
      });
      if (!message || typeof message.id !== 'string' || typeof message.clientMessageId !== 'string' || message.chatId !== selectedChatId) {
        throw new Error('Backend вернул неподтверждённое или некорректное сообщение. Черновик оставлен в поле ввода.');
      }
      setMessages((current) => mergeMessages(current, [message]));
      cursorRef.current[selectedChatId] = message.id;
      setChats((current) => current.map((chat) => chat.id === selectedChatId
        ? { ...chat, updatedAt: message.createdAt }
        : chat).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
      setDraft('');
      pendingSendRef.current = null;
      setSuccess('Сообщение сохранено сервером.');
    } catch (error) {
      setNotice(`${getErrorMessage(error)} Текст оставлен в поле; повторная отправка этого текста использует тот же Idempotency-Key.`);
    } finally { setSending(false); }
  }

  async function editMessage(message: NovaMessage) {
    const nextText = window.prompt('Изменить сообщение', message.text);
    if (nextText === null || !nextText.trim() || nextText.trim() === message.text || !selectedChatId) return;
    setMutatingMessageId(message.id);
    try {
      const updated = await authenticatedFetch<NovaMessage>(apiPath(`/chats/${selectedChatId}/messages/${message.id}`), { method: 'PATCH', body: JSON.stringify({ text: nextText.trim() }) });
      setMessages((current) => mergeMessages(current, [updated]));
      setSuccess('Сообщение изменено на сервере.');
    } catch (error) { setNotice(`Не удалось изменить сообщение: ${getErrorMessage(error)}`); }
    finally { setMutatingMessageId(null); }
  }

  async function deleteMessage(message: NovaMessage) {
    if (!selectedChatId || !window.confirm('Удалить сообщение у всех участников?')) return;
    setMutatingMessageId(message.id);
    try {
      const deleted = await authenticatedFetch<NovaMessage>(apiPath(`/chats/${selectedChatId}/messages/${message.id}`), { method: 'DELETE' });
      setMessages((current) => mergeMessages(current, [deleted]));
      setSuccess('Сообщение удалено на сервере.');
    } catch (error) { setNotice(`Не удалось удалить сообщение: ${getErrorMessage(error)}`); }
    finally { setMutatingMessageId(null); }
  }

  async function toggleMute(chat: NovaChat) {
    const mutedUntil = chat.mutedUntil && Date.parse(chat.mutedUntil) > Date.now() ? null : new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
    try {
      const preference = await authenticatedFetch<{ chatId: string; mutedUntil: string | null }>(apiPath(`/chats/${chat.id}/notifications`), { method: 'POST', body: JSON.stringify({ mutedUntil, previewEnabled: true }) });
      setChats((current) => current.map((item) => item.id === chat.id ? { ...item, mutedUntil: preference.mutedUntil } : item));
      setSuccess(preference.mutedUntil ? 'Уведомления этого диалога отключены на 8 часов.' : 'Уведомления этого диалога включены.');
    } catch (error) { setNotice(`Не удалось изменить уведомления: ${getErrorMessage(error)}`); }
  }

  const selectedChat = useMemo(() => chats.find((chat) => chat.id === selectedChatId) || null, [chats, selectedChatId]);
  const selectedPresence = selectedChat ? presenceByUser[selectedChat.participant.id] : undefined;
  const messagesLoading = selectedChatId !== null && loadingChatId === selectedChatId;
  const usernameValid = /^[A-Za-z0-9_]{3,32}$/.test(username.trim());
  const profileValid = usernameValid && displayName.trim().length >= 1 && displayName.trim().length <= 80;

  if (screen === 'email' || screen === 'verify') {
    return <main className="auth-shell">
      <div className="auth-glow auth-glow-one" /><div className="auth-glow auth-glow-two" />
      <section className="auth-side">
        <Brand />
        <div className="auth-intro">
          <span className="eyebrow"><span className="eyebrow-line" />ЛИЧНЫЕ ДИАЛОГИ · E2E</span>
          <h1>Связь без<br /><span>лишнего шума.</span></h1>
          <p>Проверьте настоящий обмен сообщениями между NOVA Web и Android — через общий API и realtime-канал.</p>
          <div className="flow-steps">
            <div className="flow-step"><span>01</span><div><b>Email-код</b><small>Одноразовый код с реальной доставкой</small></div></div>
            <div className="flow-step"><span>02</span><div><b>Личный диалог</b><small>Поиск пользователя по username</small></div></div>
            <div className="flow-step"><span>03</span><div><b>Синхронизация</b><small>Серверное подтверждение и catch-up</small></div></div>
          </div>
        </div>
        <p className="auth-footnote">NOVA · сквозной клиент для проверки ядра продукта</p>
      </section>
      <section className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-mark"><Icon name="spark" size={22} /></div>
          <p className="eyebrow">{screen === 'email' ? 'НАЧАТЬ СЕАНС' : 'ПРОВЕРИТЬ ПОЧТУ'}</p>
          <h2>{screen === 'email' ? 'Войти в NOVA' : 'Код уже в пути'}</h2>
          <p className="auth-description">{screen === 'email'
            ? 'Укажите email. Если доставка настроена, backend отправит одноразовый код на почту.'
            : <>Введите код из письма для <strong>{email}</strong>. Код одноразовый и ограничен по времени.</>}</p>
          {notice && <Notice>{notice}</Notice>}
          {success && <Notice tone="success">{success}</Notice>}
          {screen === 'email' ? <form className="form-stack" onSubmit={requestCode}>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" maxLength={320} required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            <button className="button button-primary button-wide" type="submit" disabled={busy}>{busy ? <><span className="button-spinner" />Запрашиваем код…</> : <>Получить код <Icon name="arrow" size={18} /></>}</button>
            <div className="auth-divider"><span>или</span></div>
            <button className="button button-telegram button-wide" type="button" onClick={() => void startTelegram()} disabled={busy || telegramBusy}>
              {telegramBusy ? <><span className="button-spinner button-spinner-dark" />Открываем Telegram…</> : <><Icon name="message" size={18} />Войти через Telegram</>}
            </button>
          </form> : <form className="form-stack" onSubmit={verifyCode}>
            <label htmlFor="otp">Одноразовый код</label>
            <input id="otp" className="otp-input" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={12} required placeholder="000000" value={code} onChange={(event) => setCode(event.target.value)} />
            <button className="button button-primary button-wide" type="submit" disabled={busy}>{busy ? <><span className="button-spinner" />Проверяем…</> : <>Подтвердить email <Icon name="arrow" size={18} /></>}</button>
            <button className="button button-quiet button-wide" type="button" onClick={() => { setScreen('email'); setNotice(''); setSuccess(''); setCode(''); }}>Изменить email или запросить новый код</button>
          </form>}
          <div className="auth-security"><span className="security-lock" aria-hidden="true">◆</span><span>Соединение напрямую с API <code>{API_BASE_URL}</code>. Клиент не содержит ключей почтового провайдера.</span></div>
        </div>
        <p className="legal-note">Email-код подтверждает доступ к почте. Backend может ограничивать запросы и срок действия кода.</p>
      </section>
    </main>;
  }

  if (screen === 'profile') {
    return <main className="profile-shell">
      <header className="topbar profile-topbar"><Brand /><span className="topbar-kicker">НАСТРОЙКА ПРОФИЛЯ</span><span className="topbar-spacer" /><span className="account-email">{email}</span><button className="icon-button" aria-label="Выйти" title="Выйти" onClick={() => void clearSession()}><Icon name="logout" /></button></header>
      <section className="profile-card">
        <div className="auth-card-mark"><Icon name="spark" size={22} /></div>
        <p className="eyebrow">ВАШ ПРОФИЛЬ</p>
        <h1>Задайте имя<br />для диалогов.</h1>
        <p className="auth-description">Username поможет другим участникам найти вас в тестовом сценарии. Изменения сохраняются на сервере.</p>
        {notice && <Notice>{notice}</Notice>}
        {!online && <Notice tone="info">Нет подключения к сети. Профиль нельзя сохранить офлайн.</Notice>}
        <form className="form-stack" onSubmit={saveProfile}>
          <label htmlFor="username">Username</label>
          <div className="input-prefix-wrap"><span>@</span><input id="username" autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9_]{3,32}" required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="nova_user" /></div>
          <small className="field-hint">3–32 символа: латинские буквы, цифры и подчёркивание.</small>
          <label htmlFor="display-name">Отображаемое имя</label>
          <input id="display-name" autoComplete="name" minLength={1} maxLength={80} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Как к вам обращаться" />
          <button className="button button-primary button-wide" type="submit" disabled={busy || !online || !profileValid}>{busy ? <><span className="button-spinner" />Сохраняем…</> : <>Сохранить профиль <Icon name="arrow" size={18} /></>}</button>
        </form>
      </section>
    </main>;
  }

  return <main className={`app-shell${selectedChatId ? ' has-selection' : ''}`}>
    <header className="topbar app-topbar">
      <Brand compact />
      <span className="topbar-divider" />
      <span className="topbar-kicker">ЛИЧНЫЕ ДИАЛОГИ <span className="scope-pill">E2E</span></span>
      <span className="topbar-spacer" />
      <div className={`connection-pill ${!online ? 'connection-offline' : socketState === 'connected' ? 'connection-live' : 'connection-wait'}`} aria-live="polite">
        <span className="connection-dot" />{!online ? 'Нет сети' : socketState === 'connected' ? 'Realtime подключён' : socketState === 'connecting' ? 'Подключаемся…' : 'Realtime отключён'}
      </div>
      <div className="account-chip"><span className="avatar avatar-small">{(me?.displayName || me?.username || 'N').slice(0, 1).toUpperCase()}</span><span>{me?.displayName || me?.username}</span></div>
      <button className="icon-button" aria-label="Выйти из аккаунта" title="Выйти" onClick={() => void clearSession()}><Icon name="logout" /></button>
    </header>

    {!online && <div className="offline-banner" role="status">Вы офлайн. Историю можно просматривать из уже загруженных данных; отправка и синхронизация недоступны.</div>}
    <div className="workspace">
      <aside className="sidebar" aria-label="Список диалогов">
        <div className="sidebar-heading"><div><p className="eyebrow">ВАША СЕТЬ</p><h1>Диалоги<span className="heading-count">{chats.length}</span></h1></div>
          <button className="button button-new" onClick={() => { setSearchOpen(true); setSearchError(''); setSearchResults([]); }}><Icon name="plus" size={18} /><span>Новый</span></button>
        </div>
        <button className="search-launch" onClick={() => { setSearchOpen(true); setSearchError(''); }}><Icon name="search" size={17} /><span>Найти по username</span><kbd>/</kbd></button>
        <div className="list-label"><span>ЛИЧНЫЕ</span><span>{chats.length}</span></div>
        <div className="chat-list" aria-live="polite">
          {!chatsLoaded && !chats.length && <div className="list-state"><span className="loader loader-small" />Загружаем диалоги…</div>}
          {chatsLoaded && !chats.length && <div className="empty-list"><div className="empty-icon"><Icon name="message" size={21} /></div><b>Пока нет диалогов</b><span>Найдите пользователя по username и начните личную переписку.</span><button className="text-button" onClick={() => setSearchOpen(true)}>Найти пользователя <Icon name="arrow" size={15} /></button></div>}
      {chats.map((chat) => <button key={chat.id} className={`chat-row${chat.id === selectedChatId ? ' chat-row-active' : ''}`} onClick={() => { if (chat.id === selectedChatId) return; setMessages([]); setMessagesLoadError(''); setLoadingChatId(chat.id); setSelectedChatId(chat.id); setNotice(''); setSuccess(''); }}>
            <span className="avatar">{(chat.participant.displayName || chat.participant.username || '?').slice(0, 1).toUpperCase()}</span>
            <span className="chat-row-copy"><span className="chat-row-name">{chat.participant.displayName || chat.participant.username}</span><span className="chat-row-sub">@{chat.participant.username || 'без username'}</span></span>
            <span className="chat-row-time">{chat.unreadCount ? <b className="unread-badge">{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</b> : humanDate(chat.updatedAt)}</span>
          </button>)}
        </div>
        <div className="sidebar-foot"><span className="tiny-brand-mark"><Icon name="spark" size={14} /></span><span>Только ядро E2E</span><span className="sidebar-foot-line" /></div>
      </aside>

      <section className="conversation" aria-label={selectedChat ? `Диалог с ${selectedChat.participant.displayName}` : 'Выбранный диалог'}>
        {!selectedChat ? <div className="welcome-panel">
          <div className="welcome-orbit orbit-one" /><div className="welcome-orbit orbit-two" />
          <div className="welcome-mark"><Icon name="spark" size={31} /></div>
          <p className="eyebrow">NOVA · РЕАЛЬНОЕ ВРЕМЯ</p>
          <h2>Каждый диалог<br /><span>начинается здесь.</span></h2>
          <p className="welcome-copy">Выберите переписку или найдите второго пользователя. Сообщения отправляются на сервер, подтверждаются API и приходят через Socket.IO.</p>
          <button className="button button-primary" onClick={() => setSearchOpen(true)}><Icon name="plus" size={18} />Начать диалог</button>
          <div className="welcome-foot"><span className="welcome-line" /> REST для истории <span className="welcome-separator">·</span> Socket.IO для событий</div>
        </div> : <>
          <div className="conversation-head">
            <button className="mobile-back" onClick={() => { setMessages([]); setMessagesLoadError(''); setLoadingChatId(null); setSelectedChatId(null); }} aria-label="Назад к диалогам"><Icon name="back" /></button>
            <span className="avatar">{(selectedChat.participant.displayName || selectedChat.participant.username || '?').slice(0, 1).toUpperCase()}</span>
            <div className="conversation-person"><h2>{selectedChat.participant.displayName || selectedChat.participant.username}</h2><p>@{selectedChat.participant.username} · {selectedPresence?.status === 'online' ? 'в сети' : selectedPresence?.lastSeenAt ? `был(а) ${humanDate(selectedPresence.lastSeenAt)}` : 'не в сети'}</p></div>
            <span className="conversation-state"><button className="mute-button" type="button" onClick={() => void toggleMute(selectedChat)}>{selectedChat.mutedUntil ? 'Включить звук' : 'Без звука'}</button><span className="connection-dot" />Личный диалог</span>
          </div>
          <div className="conversation-scope"><span className="scope-pill">E2E SCOPE</span><span>Текстовая переписка · Без медиа и звонков</span></div>
          {notice && <div className="conversation-notice"><Notice onClose={() => setNotice('')}>{notice}</Notice></div>}
          {success && <div className="conversation-notice"><Notice tone="success" onClose={() => setSuccess('')}>{success}</Notice></div>}
          <div className="message-scroll" aria-live="polite" aria-label="История сообщений">
            {messagesLoading ? <div className="message-placeholder"><span className="loader loader-small" />Загружаем историю с сервера…</div> : messagesLoadError ? <div className="message-empty"><div className="empty-icon"><Icon name="message" /></div><b>Не удалось загрузить историю</b><span>{messagesLoadError}</span><button className="text-button" onClick={() => { if (!selectedChatId) return; setMessagesLoadError(''); setLoadingChatId(selectedChatId); setHistoryAttempt((attempt) => attempt + 1); }}>Повторить <Icon name="arrow" size={15} /></button></div> : !messages.length ? <div className="message-empty"><div className="empty-icon"><Icon name="message" /></div><b>Начало переписки</b><span>Отправьте первое текстовое сообщение. Оно появится после подтверждения сервером.</span></div> : <>
              <div className="history-note"><span />ИСТОРИЯ С СЕРВЕРА<span /></div>
              {messages.map((message) => {
                const outgoing = message.senderId === me?.id;
                return <article key={message.id} className={`message-row${outgoing ? ' message-outgoing' : ''}`}>
                  <div className="message-bubble"><p>{message.text}</p><div className="message-meta"><time dateTime={message.createdAt}>{humanDate(message.createdAt)}</time>{message.editedAt && !message.deletedAt && <span>изменено</span>}{outgoing && <span title={message.readAt ? 'Прочитано' : message.deliveredAt ? 'Доставлено' : 'Сохранено сервером'}>{message.readAt ? '✓✓ Прочитано' : message.deliveredAt ? '✓ Доставлено' : '✓ Сохранено'}</span>}</div></div>
                  {outgoing && !message.deletedAt && <div className="message-actions"><button type="button" onClick={() => void editMessage(message)} disabled={mutatingMessageId === message.id}>Изменить</button><button type="button" onClick={() => void deleteMessage(message)} disabled={mutatingMessageId === message.id}>Удалить</button></div>}
                </article>;
              })}
            </>}
            {typingUserId === selectedChat.participant.id && <div className="typing-indicator" role="status"><span className="typing-dots"><i /><i /><i /></span>{selectedChat.participant.displayName || selectedChat.participant.username} печатает…</div>}
          </div>
          <form className="composer" onSubmit={sendMessage}>
            {!online && <p className="composer-help">Нет сети — сообщение не будет отправлено.</p>}
            <div className="composer-box"><label className="visually-hidden" htmlFor="message-text">Текст сообщения</label>
              <textarea id="message-text" value={draft} maxLength={10000} rows={1} placeholder={online ? 'Напишите сообщение…' : 'Вы офлайн'} disabled={!online} onChange={(event) => { setDraft(event.target.value); emitTyping(event.target.value.trim().length > 0); }} onBlur={() => emitTyping(false)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); emitTyping(false); event.currentTarget.form?.requestSubmit(); } }} />
              <div className="composer-actions"><span>{draft.length > 9000 ? `${draft.length}/10000` : 'Enter — отправить · Shift + Enter — перенос'}</span><button className="send-button" type="submit" disabled={!online || sending || !draft.trim()} aria-label="Отправить сообщение" title="Отправить сообщение">{sending ? <span className="button-spinner" /> : <Icon name="send" size={18} />}</button></div>
            </div>
            <p className="composer-foot">Каждое сообщение подтверждается REST API с уникальным Idempotency-Key.</p>
          </form>
        </>}
      </section>
    </div>

    {searchOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
      <section className="search-modal" role="dialog" aria-modal="true" aria-labelledby="search-title">
        <div className="modal-head"><div className="auth-card-mark modal-mark"><Icon name="search" size={20} /></div><button className="icon-button modal-close" aria-label="Закрыть" onClick={() => setSearchOpen(false)}>×</button></div>
        <p className="eyebrow">ПОИСК ПОЛЬЗОВАТЕЛЕЙ</p><h2 id="search-title">Кого ищем?</h2><p className="auth-description">Введите username. Результаты возвращает авторизованный API — фиктивных профилей здесь нет.</p>
        <form className="user-search-form" onSubmit={searchUsers}><label className="visually-hidden" htmlFor="search-username">Username пользователя</label><span>@</span><input id="search-username" autoFocus autoComplete="off" maxLength={32} placeholder="username" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /><button className="button button-primary" type="submit" disabled={searchBusy}>{searchBusy ? <span className="button-spinner" /> : <><Icon name="search" size={17} />Поиск</>}</button></form>
        {searchError && <Notice>{searchError}</Notice>}
        {searchBusy && <div className="search-state"><span className="loader loader-small" />Ищем в NOVA…</div>}
        {searchResults.length > 0 && <div className="search-results"><p className="list-label">РЕЗУЛЬТАТЫ · {searchResults.length}</p>{searchResults.map((user) => <div className="search-result" key={user.id}><span className="avatar">{(user.displayName || user.username || '?').slice(0, 1).toUpperCase()}</span><div className="search-result-copy"><b>{user.displayName || user.username}</b><span>@{user.username}</span></div>{user.id === me?.id ? <span className="self-label">Это вы</span> : <button className="button button-secondary" onClick={() => void startDirectChat(user)} disabled={chatBusyUserId !== null}>{chatBusyUserId === user.id ? <span className="button-spinner" /> : <><Icon name="message" size={16} />Открыть диалог</>}</button>}</div>)}</div>}
        <div className="modal-foot"><span className="connection-dot" />Поиск использует ваш текущий access token.</div>
      </section>
    </div>}
    {screen === 'app' && accessExpiresAt && <span className="visually-hidden" aria-live="off">Срок текущего access token: {accessExpiresAt}</span>}
  </main>;
}
