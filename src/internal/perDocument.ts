const stores = new WeakMap<Document, Map<symbol, unknown>>();

/**
 * State that belongs to the document rather than to an app instance: which dialog is on top and
 * which elements of `<body>` are inert is a fact about the page, so two apps mounted on one page
 * must share it. Created on first use (never at import time) and dropped with the document.
 */
export function perDocument<T>(key: symbol, create: () => T): T {
  let store = stores.get(document);
  if (!store) {
    store = new Map();
    stores.set(document, store);
  }
  if (!store.has(key)) store.set(key, create());

  return store.get(key) as T;
}
