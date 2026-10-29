import { useEffect, useState } from 'react';

export type Route = { page: 'queue' } | { page: 'find' } | { page: 'alerts' } | { page: 'card'; cardId: string };

function parse(hash: string): Route | null {
  const path = hash.replace(/^#\/?/, '');
  const card = /^cards\/(\d+)$/.exec(path);
  if (card) return { page: 'card', cardId: card[1] };
  if (path === 'queue' || path === 'find' || path === 'alerts') return { page: path };
  return null;
}

export function href(route: Route): string {
  return route.page === 'card' ? `#/cards/${route.cardId}` : `#/${route.page}`;
}

export function go(route: Route) {
  window.location.hash = href(route);
}

/** The current route, or null for the role's home page. */
export function useRoute(): Route | null {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
