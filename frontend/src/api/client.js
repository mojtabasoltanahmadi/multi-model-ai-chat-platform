import { useAuth } from '../stores/auth';

const BASE = '/api';

/**
 * Thin fetch wrapper: attaches the JWT, parses JSON, and converts backend
 * error responses into thrown Error objects with client-safe messages.
 */
export async function api(path, { method = 'GET', body } = {}) {
  const { state } = useAuth();
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && state.token) {
    // Session expired or revoked: force re-login.
    useAuth().clearAuth();
    window.location.assign('/login');
    throw new Error('نشست شما منقضی شده است. دوباره وارد شوید.');
  }

  let json = null;
  try {
    json = await response.json();
  } catch {
    /* empty body */
  }

  if (!response.ok) {
    const message = json?.message;
    // class-validator errors arrive as an array of messages
    const text = Array.isArray(message) ? message.join(' و ') : message;
    throw new Error(text || 'خطایی رخ داد. لطفاً دوباره تلاش کنید.');
  }
  return json;
}

/**
 * Sends a chat message and consumes the SSE stream with callbacks.
 * Uses fetch + ReadableStream because EventSource cannot send a POST/JWT.
 * Returns an abort function to cancel the stream.
 */
export function streamChatMessage(conversationId, { content, modelId, onMeta, onDelta, onDone, onError }) {
  const { state } = useAuth();
  const controller = new AbortController();

  (async () => {
    let response;
    try {
      response = await fetch(`${BASE}/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.token}`,
        },
        body: JSON.stringify({ content, modelId }),
        signal: controller.signal,
      });
    } catch {
      onError('ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید.');
      return;
    }

    if (!response.ok) {
      let message = 'خطایی رخ داد. لطفاً دوباره تلاش کنید.';
      try {
        const json = await response.json();
        message = Array.isArray(json?.message) ? json.message.join(' و ') : json?.message ?? message;
      } catch {
        /* keep default message */
      }
      onError(message);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let index;
        while ((index = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, index);
          buffer = buffer.slice(index + 2);
          let event = 'message';
          let data = '';
          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) event = line.slice(7).trim();
            else if (line.startsWith('data: ')) data += line.slice(6);
          }
          if (!data) continue;
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }
          if (event === 'meta') onMeta(parsed);
          else if (event === 'delta') onDelta(parsed);
          else if (event === 'done') onDone(parsed);
          else if (event === 'error') onError(parsed.message);
        }
      }
    } catch {
      if (!controller.signal.aborted) {
        onError('ارتباط هنگام دریافت پاسخ قطع شد.');
      }
    }
  })();

  return () => controller.abort();
}
