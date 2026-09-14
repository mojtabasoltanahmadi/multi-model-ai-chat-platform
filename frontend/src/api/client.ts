import type { AiModel, AuthResponse, Message, SendMessagePayload } from './types';

const BASE = '/api';
const TOKEN_KEY = 'hooshyar.token';
const USER_KEY = 'hooshyar.user';

// ---- Token/session helpers (kept here so the API layer owns its transport) ----

export function loadSession(): AuthResponse | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const user = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null');
    if (!user?.id) return null;
    return { accessToken: token, user };
  } catch {
    return null;
  }
}

export function saveSession(session: AuthResponse): void {
  localStorage.setItem(TOKEN_KEY, session.accessToken);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

let sessionExpiredHandler: (() => void) | null = null;

export function onSessionExpired(handler: () => void): void {
  sessionExpiredHandler = handler;
}

// ---- Core request helper ----

function authHeader(): Record<string, string> {
  const session = loadSession();
  return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

function extractError(json: unknown, fallback: string): string {
  const message = (json as { message?: unknown } | null)?.message;
  if (Array.isArray(message)) return message.join(' و ');
  if (typeof message === 'string' && message) return message;
  return fallback;
}

export class ApiError extends Error {}

export async function api<T>(
  path: string,
  { method = 'GET', body }: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && loadSession()) {
    // Session expired or revoked: clear and let the router send us to login.
    clearSession();
    sessionExpiredHandler?.();
    throw new ApiError('نشست شما منقضی شده است. دوباره وارد شوید.');
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    /* empty body (204) */
  }

  if (!response.ok) {
    throw new ApiError(extractError(json, 'خطایی رخ داد. لطفاً دوباره تلاش کنید.'));
  }
  return json as T;
}

// ---- SSE streaming (fetch + ReadableStream; EventSource cannot POST with JWT) ----

export interface StreamMetaPayload {
  /** The persisted user row (existing or freshly created). */
  userMessage: Message;
  /**
   * The assistant row, pre-persisted with status='pending' BEFORE the first
   * delta. Its id is real and stable — a reload mid-stream can address it.
   */
  assistantMessage: Message;
  model: AiModel;
  /**
   * true when this is a retry of a previous send (same clientMessageId).
   * The user row was reused; a fresh assistant row is being streamed.
   */
  replay: boolean;
}

export interface StreamEvents {
  onMeta: (payload: StreamMetaPayload) => void;
  onDelta: (payload: { text: string }) => void;
  onDone: (payload: { assistantMessage: Message }) => void;
  onError: (message: string) => void;
}

export type StreamHandle = { abort: () => void };

export function streamChatMessage(
  conversationId: string,
  payload: SendMessagePayload,
  events: StreamEvents,
): StreamHandle {
  const controller = new AbortController();

  void (async () => {
    let response: Response;
    try {
      // The backend reads clientMessageId from the body, OR from an
      // Idempotency-Key header (defense-in-depth: proxies / replay logs).
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...authHeader(),
      };
      if (payload.clientMessageId && !headers['Idempotency-Key']) {
        headers['Idempotency-Key'] = payload.clientMessageId;
      }
      response = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch {
      if (!controller.signal.aborted) {
        events.onError('ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.');
      }
      return;
    }

    if (!response.ok || !response.body) {
      let message = 'خطایی رخ داد. لطفاً دوباره تلاش کنید.';
      try {
        message = extractError(await response.json(), message);
      } catch {
        /* keep fallback */
      }
      events.onError(message);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const dispatch = (block: string) => {
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7).trim();
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      if (!data) return;
      try {
        const parsed: unknown = JSON.parse(data);
        if (event === 'meta') events.onMeta(parsed as StreamMetaPayload);
        else if (event === 'delta') events.onDelta(parsed as { text: string });
        else if (event === 'done') events.onDone(parsed as { assistantMessage: Message });
        else if (event === 'error') events.onError(String((parsed as { message?: unknown })?.message ?? 'خطا'));
      } catch {
        /* ignore malformed keep-alive lines */
      }
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let separator = buffer.indexOf('\n\n');
        while (separator !== -1) {
          dispatch(buffer.slice(0, separator));
          buffer = buffer.slice(separator + 2);
          separator = buffer.indexOf('\n\n');
        }
      }
    } catch {
      if (!controller.signal.aborted) {
        events.onError('ارتباط هنگام دریافت پاسخ قطع شد.');
      }
    }
  })();

  return { abort: () => controller.abort() };
}
