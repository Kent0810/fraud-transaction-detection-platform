import { authToken, notifierUrl } from './http';
import type { CardNotice } from './types';

const RETRY_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

export function followNotices(onNotice: (n: CardNotice) => void): () => void {
  let stopped = false;
  let xhr: XMLHttpRequest | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const connect = () => {
    const token = authToken();
    if (stopped || !token) return;
    let read = 0;
    let buffer = '';
    xhr = new XMLHttpRequest();
    xhr.open('GET', `${notifierUrl}/me/notifications/live`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    xhr.onprogress = () => {
      if (!xhr) return;
      attempt = 0;
      buffer += xhr.responseText.slice(read);
      read = xhr.responseText.length;
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
        if (type !== 'notice') continue;
        try {
          onNotice(JSON.parse(data.join('\n')) as CardNotice);
        } catch {
          continue;
        }
      }
    };
    xhr.onloadend = () => {
      if (stopped) return;
      timer = setTimeout(connect, RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)]);
    };
    xhr.send();
  };

  connect();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    xhr?.abort();
  };
}
