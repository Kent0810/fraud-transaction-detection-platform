import { useEffect, useRef } from 'react';

const SEQUENCE_MS = 900;

function typing(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * Keyboard shortcuts outside text fields. Keys are single characters ("j", "?") or two-key sequences ("g q").
 * "mod+k" matches Cmd+K on macOS and Ctrl+K elsewhere, and also works inside text fields.
 */
export function useHotkeys(bindings: Record<string, (e: KeyboardEvent) => void>) {
  const ref = useRef(bindings);
  ref.current = bindings;

  useEffect(() => {
    let pending: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const onKey = (e: KeyboardEvent) => {
      const map = ref.current;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && map['mod+k']) {
        e.preventDefault();
        map['mod+k'](e);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (document.querySelector('dialog[open]')) return;
      if (e.key === 'Enter' && e.target instanceof HTMLElement && e.target.closest('button, a')) return;

      const key = e.key;
      const combo = pending ? `${pending} ${key}` : null;
      if (combo && map[combo]) {
        e.preventDefault();
        pending = null;
        map[combo](e);
        return;
      }
      if (Object.keys(map).some((k) => k.startsWith(`${key} `))) {
        pending = key;
        clearTimeout(timer);
        timer = setTimeout(() => (pending = null), SEQUENCE_MS);
        return;
      }
      pending = null;
      if (map[key]) {
        e.preventDefault();
        map[key](e);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer);
    };
  }, []);
}
