const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/$/, '');

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

// Set by AuthProvider. A 401 means the staff session is gone (expired, signed out, account disabled).
let token: string | null = null;
let onUnauthorized: () => void = () => {};

export function setAuth(next: string | null, unauthorized: () => void = () => {}) {
  token = next;
  onUnauthorized = unauthorized;
}

function headers(json: boolean): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function fail(res: Response): Promise<never> {
  if (res.status === 401 && token) onUnauthorized();
  const body = await res.json().catch(() => null);
  const message = Array.isArray(body?.message) ? body.message.join(', ') : (body?.message ?? res.statusText);
  throw new HttpError(res.status, message);
}

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: headers(body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) await fail(res);
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/**
 * Reads a server-sent event stream with fetch rather than EventSource, so the session token can go in the
 * Authorization header. Resolves when the server closes the stream; rejects on an error or when aborted.
 */
export async function stream(
  path: string,
  onEvent: (type: string, data: string) => void,
  onOpen: () => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { headers: headers(false), signal });
  if (!res.ok || !res.body) await fail(res);
  onOpen();
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += value;
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let type = 'message';
      const data: string[] = [];
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) type = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      onEvent(type, data.join('\n'));
    }
  }
}
