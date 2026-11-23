'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { AppearanceButton } from '@/components/appearance';
import NovaAssistant from '@/components/NovaAssistant';
import { ProfileEditor, UserAvatar } from '@/components/profile-editor';
import { CallControls } from '@/components/call-controls';
import { API_BASE_URL, apiFetch, apiPath, NovaApiError } from '@/lib/api';
import type { AuthTokens, MessagePage, NovaChat, NovaMessage, NovaPublicUser, NovaUser } from '@/lib/types';

type Screen = 'email' | 'verify' | 'profile' | 'app';
type AuthMode = 'register' | 'login';
const DOWNLOAD_URL = process.env.NEXT_PUBLIC_NOVA_DOWNLOAD_URL;
type SocketState = 'connecting' | 'connected' | 'disconnected';
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
    <span className="brand-mark" aria-hidden="true">N</span>
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

function needsProfileSetup(user: NovaUser) {
  return !user.username || !user.displayName ||
    (user.displayName === 'Пользователь NOVA' && /^nova_[a-f0-9]{12}$/.test(user.username));
}

function isNovaChat(value: unknown): value is NovaChat {
  if (!value || typeof value !== 'object') return false;
  const chat = value as Partial<NovaChat>;
  return typeof chat.id === 'string' && Boolean(chat.participant && typeof chat.participant.id === 'string');
}

export default function HomePage() {
  const [screen, setScreen] = useState<Screen>('email');
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [accessExpiresAt, setAccessExpiresAt] = useState<string | null>(null);
  const [me, setMe] = useState<NovaUser | null>(null);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [success, setSuccess] = useState('');
  const [online, setOnline] = useState(true);
  const [socketState, setSocketState] = useState<SocketState>('connecting');
  const [callSocket, setCallSocket] = useState<Socket | null>(null);
  const [chats, setChats] = useState<NovaChat[]>([]);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<NovaMessage[]>([]);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);
  const [messagesLoadError, setMessagesLoadError] = useState('');
  const [historyAttempt, setHistoryAttempt] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<NovaPublicUser[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [chatBusyUserId, setChatBusyUserId] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const chatsRef = useRef<NovaChat[]>([]);
  const selectedChatRef = useRef<string | null>(null);
  const cursorRef = useRef<Record<string, string>>({});
  const refreshInFlight = useRef<Promise<string> | null>(null);
  const accessTokenRef = useRef<string | null>(null);
  const sessionGeneration = useRef(0);
  const pendingSendRef = useRef<Record<string, { text: string; key: string }>>({});
  const searchDialogRef = useRef<HTMLDialogElement>(null);
  const historyTailRef = useRef<HTMLDivElement>(null);
  const draft = selectedChatId ? drafts[selectedChatId] ?? '' : '';

  useEffect(() => {
    const dialog = searchDialogRef.current;
    if (searchOpen && dialog && !dialog.open) dialog.showModal();
    if (!searchOpen && dialog?.open) dialog.close();
  }, [searchOpen]);

  useEffect(() => {
    historyTailRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedChatId, messages]);

  useEffect(() => { chatsRef.current = chats; }, [chats]);



  const saveTokens = useCallback((tokens: AuthTokens) => {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    accessTokenRef.current = tokens.accessToken;
    setAccessToken(tokens.accessToken);
    setAccessExpiresAt(tokens.accessTokenExpiresAt);
    setMe(tokens.user);
    void apiFetch<NovaUser>(apiPath('/users/me'), {}, tokens.accessToken).then((profile) => {
      setMe((current) => current?.id === profile.id ? profile : current);
    }).catch(() => {});
    setEmail(tokens.user.email);
    setUsername(tokens.user.username || '');
    setDisplayName(tokens.user.displayName || '');
    setChats([]);
    setChatsLoaded(false);
    setMessages([]);
    setSocketState('connecting');
    setNotice('');
    setSuccess('');
    setScreen(needsProfileSetup(tokens.user) ? 'profile' : 'app');
  }, []);

  const discardSession = useCallback(() => {
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    socketRef.current?.disconnect();
    socketRef.current = null;
    setCallSocket(null);
    accessTokenRef.current = null;
    sessionGeneration.current += 1;
    setAccessToken(null);
    setAccessExpiresAt(null);
    setMe(null);
    setChats([]);
    chatsRef.current = [];
    setChatsLoaded(false);
    setMessages([]);
    setLoadingChatId(null);
    setMessagesLoadError('');
    selectedChatRef.current = null;
    setSelectedChatId(null);
    setSocketState('connecting');
    setDrafts({});
    setSending(false);
    setSearchOpen(false);
    setSearchResults([]);
    setSearchTerm('');
    setEmail('');
    setCode('');
    pendingSendRef.current = {};
    cursorRef.current = {};
    setScreen('email');
    setNotice('');
    setSuccess('');
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<string> => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const refreshToken = window.sessionStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) throw new NovaApiError({ status: 401, message: 'Сессия завершена. Войдите по email.' });

    const refreshPromise = apiFetch<AuthTokens>(apiPath('/auth/refresh'), {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    }).then((tokens) => {
      if (!tokens.accessToken || !tokens.refreshToken || !tokens.accessTokenExpiresAt) {
        throw new Error('Сервер не смог обновить данные сеанса.');
      }
      if (window.sessionStorage.getItem(REFRESH_TOKEN_KEY) !== refreshToken) {
        throw new NovaApiError({ status: 401, message: 'Сессия завершена.' });
      }
      window.sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
      accessTokenRef.current = tokens.accessToken;
      setAccessToken(tokens.accessToken);
      setAccessExpiresAt(tokens.accessTokenExpiresAt);
      return tokens.accessToken;
    }).catch((error: unknown) => {
      if (error instanceof NovaApiError && error.status === 401 &&
          window.sessionStorage.getItem(REFRESH_TOKEN_KEY) === refreshToken) discardSession();
      throw error;
    }).finally(() => {
      if (refreshInFlight.current === refreshPromise) refreshInFlight.current = null;
    });
    refreshInFlight.current = refreshPromise;
    return refreshPromise;
  }, [discardSession]);

  const authenticatedFetch = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const token = accessTokenRef.current;
    const generation = sessionGeneration.current;
    const requireSession = () => {
      if (sessionGeneration.current !== generation) {
        throw new NovaApiError({ status: 401, message: 'Сессия завершена.' });
      }
    };
    if (!token) throw new NovaApiError({ status: 401, message: 'Войдите, чтобы продолжить.' });
    let result: T;
    try {
      result = await apiFetch<T>(path, options, token);
    } catch (error) {
      requireSession();
      if (!(error instanceof NovaApiError) || error.status !== 401) throw error;
      const currentToken = accessTokenRef.current;
      const nextToken = currentToken && currentToken !== token ? currentToken : await refreshAccessToken();
      result = await apiFetch<T>(path, options, nextToken);
    }
    requireSession();
    return result;
  }, [refreshAccessToken]);

  const clearSession = useCallback(async () => {
    refreshInFlight.current = null;
    discardSession();
    if (accessToken) {
      await apiFetch<void>(apiPath('/auth/logout'), { method: 'POST' }, accessToken).catch(() => {
        // The tab is already signed out if the API is temporarily unreachable.
      });
    }
  }, [accessToken, discardSession]);

  useEffect(() => {
    if (!window.sessionStorage.getItem(REFRESH_TOKEN_KEY)) return;
    let active = true;
    void refreshAccessToken().then(async (token) => {
      const user = await apiFetch<NovaUser>(apiPath('/users/me'), {}, token);
      if (!active) return;
      setMe(user);
      setEmail(user.email);
      setUsername(user.username || '');
      setDisplayName(user.displayName || '');
      setScreen(needsProfileSetup(user) ? 'profile' : 'app');
    }).catch((error: unknown) => {
      if (active && !(error instanceof NovaApiError && error.status === 401)) {
        setNotice(`Не удалось восстановить сессию: ${getErrorMessage(error)}`);
      }
    });
    return () => { active = false; };
  }, [refreshAccessToken]);

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
    if (screen !== 'app') return;
    const socket = io(API_BASE_URL, {
      path: '/socket.io/',
      autoConnect: false,
      auth: (sendAuth) => sendAuth({ token: accessTokenRef.current }),
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;
    let refreshingSocket = false;
    let active = true;
    let listRefresh = 0;
    const reloadChats = () => {
      const request = ++listRefresh;
      void authenticatedFetch<NovaChat[]>(apiPath('/chats')).then((items) => {
        if (!active || request !== listRefresh) return;
        setChats(items);
        chatsRef.current = items;
        setChatsLoaded(true);
      }).catch((error: unknown) => {
        if (active) setNotice(getErrorMessage(error));
      });
    };

    socket.on('connect', () => {
      setSocketState('connected');
      setCallSocket(socket);
      reloadChats();
      chatsRef.current.forEach((chat) => {
        socket.emit('chat:join', { chatId: chat.id }, (ack?: { error?: { message?: string } }) => {
          if (ack?.error?.message) setNotice(`Не удалось подключиться к диалогу: ${ack.error.message}`);
        });
      });
      const activeChat = selectedChatRef.current;
      if (activeChat) void catchUpChat(activeChat).catch((error: unknown) => setNotice(`Не удалось восстановить историю после подключения: ${getErrorMessage(error)}`));
    });
    socket.on('disconnect', () => {
      setSocketState('disconnected');
      setCallSocket(null);
    });
    socket.on('connect_error', (error: Error) => {
      setCallSocket(null);
      setSocketState('disconnected');
      if (refreshingSocket || !/auth|token|unauthorized|expired|jwt/i.test(error.message)) return;
      refreshingSocket = true;
      void refreshAccessToken().then(() => {
        if (active && !socket.connected) socket.connect();
      }).catch((refreshError: unknown) => {
        setNotice(`Не удалось обновить сессию для realtime: ${getErrorMessage(refreshError)}`);
      }).finally(() => { refreshingSocket = false; });
    });
    socket.on('chat:new', reloadChats);
    socket.on('message:new', (message: NovaMessage) => {
      if (!message || typeof message.id !== 'string' || typeof message.chatId !== 'string') return;
      if (message.chatId === selectedChatRef.current) {
        setMessages((current) => mergeMessages(current, [message]));
      }
      setChats((current) => current.map((chat) => chat.id === message.chatId
        ? { ...chat, updatedAt: message.createdAt }
        : chat).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
    });
    socket.connect();
    return () => {
      active = false;
      setCallSocket((current) => current === socket ? null : current);
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [screen, authenticatedFetch, catchUpChat, refreshAccessToken]);

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
      setMessages((current) => selectedChatRef.current === selectedChatId ? mergeMessages(current, items) : current);
      setLoadingChatId(null);
      setMessagesLoadError('');
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
    return () => { active = false; };
  }, [selectedChatId, accessToken, screen, authenticatedFetch, historyAttempt, catchUpChat]);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice('');
    setSuccess('');
    try {
      await apiFetch<void>(apiPath('/auth/request-code'), { method: 'POST', body: JSON.stringify({ email: email.trim() }) });
      setScreen('verify');
      setSuccess('Проверьте также папку «Спам».');
    } catch (error) {
      setNotice(getErrorMessage(error));
    } finally { setBusy(false); }
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
      setSuccess('');
    } catch (error) { setNotice(getErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function searchUsers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = searchTerm.trim().replace(/^@/, '');
    if (!term) {
      setSearchError('Введите имя пользователя.');
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
      if (!results.length) setSearchError('Пользователь не найден. Проверьте написание.');
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
      selectedChatRef.current = chat.id;
      setSelectedChatId(chat.id);
      setSearchOpen(false);
      setSearchResults([]);
      setSearchTerm('');
      setSuccess('');
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
      const pending = pendingSendRef.current[selectedChatId];
      const clientMessageId = pending?.text === text
        ? pending.key
        : crypto.randomUUID();
      pendingSendRef.current[selectedChatId] = { text, key: clientMessageId };
      const message = await authenticatedFetch<NovaMessage>(apiPath(`/chats/${selectedChatId}/messages`), {
        method: 'POST',
        headers: { 'Idempotency-Key': clientMessageId },
        body: JSON.stringify({ text }),
      });
      if (!message || typeof message.id !== 'string' || typeof message.clientMessageId !== 'string' || message.chatId !== selectedChatId) {
        throw new Error('Backend вернул неподтверждённое или некорректное сообщение. Черновик оставлен в поле ввода.');
      }
      setMessages((current) => selectedChatRef.current === selectedChatId ? mergeMessages(current, [message]) : current);
      setChats((current) => current.map((chat) => chat.id === selectedChatId
        ? { ...chat, updatedAt: message.createdAt }
        : chat).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
      setDrafts((current) => current[selectedChatId]?.trim() === text ? { ...current, [selectedChatId]: '' } : current);
      delete pendingSendRef.current[selectedChatId];
    } catch (error) {
      if (selectedChatRef.current === selectedChatId) setNotice(`${getErrorMessage(error)} Черновик сохранён.`);
    } finally { setSending(false); }
  }

  const selectedChat = useMemo(() => chats.find((chat) => chat.id === selectedChatId) || null, [chats, selectedChatId]);
  const messagesLoading = selectedChatId !== null && loadingChatId === selectedChatId;
  const usernameValid = /^[A-Za-z0-9_]{3,32}$/.test(username.trim());
  const profileValid = usernameValid && displayName.trim().length >= 1 && displayName.trim().length <= 80;

  if (screen === 'email' || screen === 'verify') {
    return <main className="auth-shell">
      <section className="auth-side">
        <div className="auth-brand-row"><Brand /><AppearanceButton /></div>
        <div className="auth-intro">
          <h1>Пространство для <span>разговоров.</span></h1>
          <p>Находите друзей по имени пользователя и продолжайте переписку в браузере или на Android.</p>
          {DOWNLOAD_URL && <a className="download-link" href={DOWNLOAD_URL}>Скачать NOVA для Android <Icon name="arrow" size={16} /></a>}
        </div>
      </section>
      <section className="auth-form-side">
        <div className="auth-card" key={screen}>
          <h2>{screen === 'verify' ? 'Проверьте почту' : authMode === 'register' ? 'Создайте аккаунт' : 'Войдите в NOVA'}</h2>
          <p className="auth-description">{screen === 'email'
            ? 'Введите электронную почту, чтобы получить одноразовый код.'
            : <>Введите код из письма для <strong>{email}</strong>.</>}</p>
          {!API_BASE_URL && <Notice tone="info">Регистрация и вход откроются после подключения сервера NOVA.</Notice>}
          {notice && <div id="auth-error"><Notice>{notice}</Notice></div>}
          {success && <Notice tone="success">{success}</Notice>}
          {screen === 'email' ? <form className="form-stack" onSubmit={requestCode}>
            <label htmlFor="email">Email</label>
            <input id="email" aria-describedby={notice ? "auth-error" : undefined} type="email" disabled={!API_BASE_URL} autoComplete="email" maxLength={320} required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            <button className="button button-primary button-wide" type="submit" disabled={busy || !API_BASE_URL}>{busy ? <><span className="button-spinner" />Запрашиваем код…</> : <>Получить код <Icon name="arrow" size={18} /></>}</button>
          </form> : <form className="form-stack" onSubmit={verifyCode}>
            <label htmlFor="otp">Одноразовый код</label>
            <input id="otp" aria-describedby={notice ? "auth-error" : undefined} className="otp-input" pattern="[0-9]{6,12}" inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={12} required placeholder="000000" value={code} onChange={(event) => setCode(event.target.value)} />
            <button className="button button-primary button-wide" type="submit" disabled={busy || !API_BASE_URL}>{busy ? <><span className="button-spinner" />Проверяем…</> : <>Подтвердить email <Icon name="arrow" size={18} /></>}</button>
            <button className="button button-quiet button-wide" type="button" onClick={() => { setScreen('email'); setNotice(''); setSuccess(''); setCode(''); }}>Изменить email или запросить новый код</button>
          </form>}
          {screen === 'email' && <div className="auth-mode">
            <span>{authMode === 'register' ? 'Уже зарегистрированы?' : 'Впервые в NOVA?'}</span>
            <button type="button" className="text-button" disabled={busy} onClick={() => {
              setAuthMode(authMode === 'register' ? 'login' : 'register');
              setNotice('');
            }}>{authMode === 'register' ? 'Войти' : 'Создать аккаунт'}</button>
          </div>}
        </div>
      </section>
    </main>;
  }

  if (screen === 'profile') {
    return <main className="profile-shell">
      <header className="topbar profile-topbar"><Brand /><span className="topbar-kicker">НАСТРОЙКА ПРОФИЛЯ</span><span className="topbar-spacer" /><span className="account-email">{email}</span><AppearanceButton /><button className="icon-button" aria-label="Выйти" title="Выйти" onClick={() => void clearSession()}><Icon name="logout" /></button></header>
      <section className="profile-card">
        <div className="auth-card-mark"><Icon name="spark" size={22} /></div>
        <h1>Настройте профиль</h1>
        <p className="auth-description">Другие пользователи NOVA смогут найти вас по имени пользователя.</p>
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
      <span className="topbar-spacer" />
      <div className={`connection-pill ${!online ? 'connection-offline' : socketState === 'connected' ? 'connection-live' : 'connection-wait'}`} aria-live="polite">
        <span className="connection-dot" />{!online ? 'Нет сети' : socketState === 'connected' ? 'На связи' : socketState === 'connecting' ? 'Подключаемся…' : 'Связь прервана'}
      </div>
      <AppearanceButton />
      {accessToken && <NovaAssistant accessToken={accessToken} />}
      <CallControls socket={callSocket} chat={selectedChat} />
      {me && <ProfileEditor user={me} request={authenticatedFetch} onUpdate={setMe} />}
      <button className="icon-button" aria-label="Выйти из аккаунта" title="Выйти" onClick={() => void clearSession()}><Icon name="logout" /></button>
    </header>

    {!online && <div className="offline-banner" role="status">Вы офлайн. Историю можно просматривать из уже загруженных данных; отправка и синхронизация недоступны.</div>}
    <div className="workspace">
      <aside className="sidebar" aria-label="Список диалогов">
        <div className="sidebar-heading"><h1>Диалоги</h1>
          <button className="button button-new" onClick={() => { setSearchOpen(true); setSearchError(''); setSearchResults([]); }}><Icon name="plus" size={18} /><span>Новый</span></button>
        </div>
        <button className="search-launch" onClick={() => { setSearchOpen(true); setSearchError(''); }}><Icon name="search" size={17} /><span>Найти по username</span><kbd>/</kbd></button>
        <div className="chat-list" aria-live="polite">
          {!chatsLoaded && !chats.length && <div className="list-state"><span className="loader loader-small" />Загружаем диалоги…</div>}
          {chatsLoaded && !chats.length && <div className="empty-list"><div className="empty-icon"><Icon name="message" size={21} /></div><b>Пока нет диалогов</b><span>Найдите пользователя по username и начните личную переписку.</span><button className="text-button" onClick={() => setSearchOpen(true)}>Найти пользователя <Icon name="arrow" size={15} /></button></div>}
      {chats.map((chat) => <button key={chat.id} className={`chat-row${chat.id === selectedChatId ? ' chat-row-active' : ''}`} aria-current={chat.id === selectedChatId ? true : undefined} onClick={() => { if (chat.id === selectedChatId) return; setMessages([]); setMessagesLoadError(''); setLoadingChatId(chat.id); selectedChatRef.current = chat.id; setSelectedChatId(chat.id); setNotice(''); setSuccess(''); }}>
            <UserAvatar user={chat.participant} />
            <span className="chat-row-copy"><span className="chat-row-name">{chat.participant.displayName || chat.participant.username}</span><span className="chat-row-sub">@{chat.participant.username || 'без username'}</span></span>
            <span className="chat-row-time">{humanDate(chat.updatedAt)}</span>
          </button>)}
        </div>
      </aside>

      <section className="conversation" aria-label={selectedChat ? `Диалог с ${selectedChat.participant.displayName}` : 'Выбранный диалог'}>
        {!selectedChat ? <div className="welcome-panel">
          <div className="welcome-orbit orbit-one" /><div className="welcome-orbit orbit-two" />
          <div className="welcome-mark"><Icon name="spark" size={31} /></div>
          <h2>Каждый диалог<br /><span>начинается здесь.</span></h2>
          <p className="welcome-copy">Откройте диалог в списке или найдите собеседника по имени пользователя.</p>
          <button className="button button-primary" onClick={() => setSearchOpen(true)}><Icon name="plus" size={18} />Начать диалог</button>
        </div> : <>
          <div className="conversation-head">
            <button className="mobile-back" onClick={() => { setMessages([]); setMessagesLoadError(''); setLoadingChatId(null); selectedChatRef.current = null; setSelectedChatId(null); }} aria-label="Назад к диалогам"><Icon name="back" /></button>
            <UserAvatar user={selectedChat.participant} />
            <div className="conversation-person"><h2>{selectedChat.participant.displayName || selectedChat.participant.username}</h2><p>@{selectedChat.participant.username}</p></div>
            <span className="conversation-state"><span className="connection-dot" />Личный диалог</span>
          </div>
          {notice && <div className="conversation-notice"><Notice onClose={() => setNotice('')}>{notice}</Notice></div>}
          {success && <div className="conversation-notice"><Notice tone="success" onClose={() => setSuccess('')}>{success}</Notice></div>}
          <div className="message-scroll" aria-live="polite" aria-label="История сообщений">
            {messagesLoading ? <div className="message-placeholder"><span className="loader loader-small" />Загружаем сообщения…</div> : messagesLoadError ? <div className="message-empty"><div className="empty-icon"><Icon name="message" /></div><b>Не удалось загрузить историю</b><span>{messagesLoadError}</span><button className="text-button" onClick={() => { if (!selectedChatId) return; setMessagesLoadError(''); setLoadingChatId(selectedChatId); setHistoryAttempt((attempt) => attempt + 1); }}>Повторить <Icon name="arrow" size={15} /></button></div> : !messages.length ? <div className="message-empty"><div className="empty-icon"><Icon name="message" /></div><b>Начало переписки</b><span>Отправьте первое текстовое сообщение.</span></div> : <>
              {messages.map((message) => {
                const outgoing = message.senderId === me?.id;
                return <article key={message.id} className={`message-row${outgoing ? ' message-outgoing' : ''}`}>
                  <div className="message-bubble"><p>{message.text}</p><div className="message-meta"><time dateTime={message.createdAt}>{humanDate(message.createdAt)}</time>{outgoing && <span title={message.deliveredAt ? 'Доставлено' : 'Сохранено сервером'}>{message.deliveredAt ? 'Доставлено' : 'Сервер ✓'}</span>}</div></div>
                </article>;
              })}
            </>}
            <div ref={historyTailRef} />
          </div>
          <form className="composer" onSubmit={sendMessage}>
            {!online && <p className="composer-help">Нет сети — сообщение не будет отправлено.</p>}
            <div className="composer-box"><label className="visually-hidden" htmlFor="message-text">Текст сообщения</label>
              <textarea id="message-text" value={draft} maxLength={10000} rows={1} placeholder={online ? 'Напишите сообщение…' : 'Вы офлайн'} disabled={!online} onChange={(event) => {
                const chatId = selectedChatId;
                const value = event.target.value;
                if (chatId) setDrafts((current) => ({ ...current, [chatId]: value }));
              }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
              <div className="composer-actions"><span>{draft.length > 9000 ? `${draft.length}/10000` : 'Enter — отправить · Shift + Enter — перенос'}</span><button className="send-button" type="submit" disabled={!online || sending || !draft.trim()} aria-label="Отправить сообщение" title="Отправить сообщение">{sending ? <span className="button-spinner" /> : <Icon name="send" size={18} />}</button></div>
            </div>
          </form>
        </>}
      </section>
    </div>

    <dialog className="glass-dialog search-modal" ref={searchDialogRef} aria-labelledby="search-title" onClose={() => setSearchOpen(false)}>
      {searchOpen && <>
        <div className="modal-head"><div className="auth-card-mark modal-mark"><Icon name="search" size={20} /></div><button className="icon-button modal-close" aria-label="Закрыть" onClick={() => setSearchOpen(false)}>×</button></div>
        <p className="eyebrow">ПОИСК ПОЛЬЗОВАТЕЛЕЙ</p><h2 id="search-title">Кого ищем?</h2><p className="auth-description">Введите имя пользователя NOVA.</p>
        <form className="user-search-form" onSubmit={searchUsers}><label className="visually-hidden" htmlFor="search-username">Username пользователя</label><span>@</span><input id="search-username" autoFocus autoComplete="off" maxLength={32} placeholder="username" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /><button className="button button-primary" type="submit" disabled={searchBusy}>{searchBusy ? <span className="button-spinner" /> : <><Icon name="search" size={17} />Поиск</>}</button></form>
        {searchError && <Notice>{searchError}</Notice>}
        {searchBusy && <div className="search-state"><span className="loader loader-small" />Ищем в NOVA…</div>}
        {searchResults.length > 0 && <div className="search-results"><p className="list-label">РЕЗУЛЬТАТЫ · {searchResults.length}</p>{searchResults.map((user) => <div className="search-result" key={user.id}><UserAvatar user={user} /><div className="search-result-copy"><b>{user.displayName || user.username}</b><span>@{user.username}</span></div>{user.id === me?.id ? <span className="self-label">Это вы</span> : <button className="button button-secondary" onClick={() => void startDirectChat(user)} disabled={chatBusyUserId !== null}>{chatBusyUserId === user.id ? <span className="button-spinner" /> : <><Icon name="message" size={16} />Открыть диалог</>}</button>}</div>)}</div>}
      </>}
    </dialog>
  </main>;
}
