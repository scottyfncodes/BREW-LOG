import { useEffect, useState } from 'preact/hooks';

// Hash routing keeps deep links working on GitHub Pages without a server.

export interface Route {
  path: string[];
  query: URLSearchParams;
}

export function parseHash(hash = location.hash): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [p, q = ''] = raw.split('?');
  return { path: p.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q) };
}

export function href(path: string, query?: Record<string, string | undefined>): string {
  const qs = query
    ? new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => !!e[1])).toString()
    : '';
  return `#/${path.replace(/^\//, '')}${qs ? '?' + qs : ''}`;
}

export function navigate(path: string, query?: Record<string, string | undefined>, replace = false) {
  const h = href(path, query);
  if (replace) history.replaceState(null, '', h);
  else location.hash = h;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function back(fallback = '') {
  let navigated = false;
  try {
    navigated = sessionStorage.getItem('bl-nav') === '1';
  } catch {
    /* private mode */
  }
  if (history.length > 1 && navigated) history.back();
  else navigate(fallback, undefined, true);
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parseHash);
  const lastHash = location.hash;
  useEffect(() => {
    const on = () => {
      try {
        sessionStorage.setItem('bl-nav', '1');
      } catch {
        /* private mode */
      }
      setRoute(parseHash());
    };
    window.addEventListener('hashchange', on);
    // Catch any navigation that happened before this listener existed.
    if (location.hash !== lastHash) setRoute(parseHash());
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
