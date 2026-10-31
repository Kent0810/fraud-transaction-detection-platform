const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export const apiEnabled = !!API_URL;
export const apiUrl = API_URL;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** The server's own reason, when it gave one (Nest's `message`); safe to show. */
    readonly detail: string | null = null,
  ) {
    super(message);
  }
}

async function reason(res: Response): Promise<string | null> {
  try {
    const { message } = (await res.json()) as { message?: string | string[] };
    return Array.isArray(message) ? message.join(', ') : (message ?? null);
  } catch {
    return null;
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

// Set by AuthProvider. The token is sent on every request; a 401 means the session is gone (expired, logged out, card locked).
let token: string | null = null;
let onUnauthorized: () => void = () => {};

export function setAuth(next: string | null, unauthorized: () => void = () => {}) {
  token = next;
  onUnauthorized = unauthorized;
}

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  // Only a 401 for the token in use now means the session is gone; one sent without it (or with an older one) doesn't.
  const sent = token;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401 && sent && sent === token) onUnauthorized();
    throw new HttpError(res.status, `${res.status} ${res.statusText} for ${method} ${path}`, await reason(res));
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// The signed-in card comes from the token, so the API never takes a card number in the URL.
export const ME = '/me';
