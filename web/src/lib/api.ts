import type { ApiErrorPayload } from '@/lib/types';

const configuredBaseUrl = process.env.NEXT_PUBLIC_NOVA_API_BASE_URL?.trim();
const developmentBaseUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001';
export const API_BASE_URL = (configuredBaseUrl || developmentBaseUrl).replace(/\/+$/, '');

export class NovaApiError extends Error {
  status: number;
  requestId?: string;

  constructor(payload: ApiErrorPayload) {
    super(payload.message);
    this.name = 'NovaApiError';
    this.status = payload.status;
    this.requestId = payload.requestId;
  }
}

function apiMessage(status: number, serverMessage?: string): string {
  if (status === 503) {
    return 'Сервис временно недоступен. Попробуйте позже.';
  }
  if (status === 429) return 'Слишком много запросов. Подождите немного и повторите попытку.';
  if (status === 401) return 'Сессия истекла. Войдите ещё раз.';
  if (status === 403) return 'У вас нет доступа к этому действию или диалогу.';
  if (status === 404) return 'Запрошенный объект не найден.';
  if (status === 409) return serverMessage || 'Конфликт данных: проверьте username или повторите запрос.';
  if (status >= 500) return serverMessage || `Сервер временно недоступен (HTTP ${status}).`;
  if (status === 0) return 'Не удалось связаться с API. Проверьте адрес сервера и подключение к сети.';
  return serverMessage || `Запрос отклонён (HTTP ${status}). Проверьте введённые данные.`;
}

async function readError(response: Response): Promise<NovaApiError> {
  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    // Non-JSON error bodies are valid HTTP responses too.
  }
  const messageValue = payload.message;
  const message = Array.isArray(messageValue)
    ? messageValue.filter((part): part is string => typeof part === 'string').join(' ')
    : typeof messageValue === 'string'
      ? messageValue
      : undefined;
  return new NovaApiError({
    status: response.status,
    message: apiMessage(response.status, message),
    requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
  });
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string,
): Promise<T> {
  if (!API_BASE_URL) {
    throw new NovaApiError({ status: 503, message: 'Регистрация и вход откроются после подключения сервера NOVA.' });
  }
  const headers = new Headers(options.headers);
  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      cache: 'no-store',
      headers,
    });
  } catch {
    throw new NovaApiError({ status: 0, message: apiMessage(0) });
  }

  if (!response.ok) throw await readError(response);
  if (response.status === 202 || response.status === 204) return undefined as T;

  try {
    const body = await response.text();
    if (!body.trim()) return undefined as T;
    return JSON.parse(body) as T;
  } catch {
    throw new NovaApiError({
      status: response.status,
      message: 'Сервер вернул ответ в неожиданном формате. Проверьте совместимость backend-контракта.',
    });
  }
}

export function apiPath(path: string): string {
  return `/api/v1${path}`;
}
