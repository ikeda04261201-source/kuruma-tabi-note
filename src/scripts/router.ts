/**
 * Simple hash-based router
 */

export type Route = 'welcome' | 'name-car' | 'home' | 'checklist' | 'record' | 'record-edit' | 'map' | 'car' | 'about';

type RouteHandler = (params?: Record<string, string>) => void;

const handlers: Map<Route, RouteHandler> = new Map();

export function onRoute(route: Route, handler: RouteHandler): void {
  handlers.set(route, handler);
}

export function navigate(route: Route, params?: Record<string, string>): void {
  let hash = `#${route}`;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    if (qs) hash += `?${qs}`;
  }
  window.location.hash = hash;
}

export function getCurrentRoute(): { route: Route; params: Record<string, string> } {
  const hash = window.location.hash.slice(1) || 'home';
  const [routePart, queryPart] = hash.split('?');
  const params: Record<string, string> = {};
  if (queryPart) {
    new URLSearchParams(queryPart).forEach((v, k) => {
      params[k] = v;
    });
  }
  return { route: routePart as Route, params };
}

export function startRouter(): void {
  const handle = () => {
    const { route, params } = getCurrentRoute();
    const handler = handlers.get(route);
    if (handler) handler(params);
  };

  window.addEventListener('hashchange', handle);
  handle();
}
