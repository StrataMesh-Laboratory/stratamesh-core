export function createServerFn(_opts?: { method?: string }) {
  const api = {
    validator: (_fn: unknown) => api,
    handler: (fn: unknown) => fn,
  };
  return api;
}

export function createMiddleware() {
  return { input: () => ({ handler: () => ({}) }) };
}
