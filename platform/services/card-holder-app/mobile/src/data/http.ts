const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');

export const apiEnabled = !!API_URL;
export const apiUrl = API_URL;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    throw new HttpError(res.status, `${res.status} ${res.statusText} for ${method} ${path}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const cardPath = (cardId: string) => `/cards/${encodeURIComponent(cardId)}`;
