/**
 * How a request reaches the server: the `fetch` signature, so `fetch` itself, a test double or a wrapper
 * (extra headers, a mock adapter) all fit. It must reject for transport failures and honour `init.signal`.
 */
export type Transport = (url: string, init: RequestInit) => Promise<Response>;

/** The default: the platform `fetch`, looked up at call time (nothing is captured when the module loads). */
export const fetchTransport: Transport = (url, init) => globalThis.fetch(url, init);
