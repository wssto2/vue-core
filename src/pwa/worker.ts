export interface ServiceWorkerOptions {
  /** Where the application serves its worker. Default `/sw.js`. */
  url?: string;
  /** Default true. Pass `import.meta.env.PROD` (and `false` inside an embedding page's iframe): a worker in development caches the dev server's modules. */
  enabled?: boolean;
}

/** The build entry the running page loaded, e.g. "/assets/main-3f9a.js" (hashed, so each deploy has its own). */
function currentBuildEntry(): string | null {
  const script = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]');
  return script ? new URL(script.src, location.href).pathname : null;
}

/**
 * Registers the application's service worker. The build entry goes into the worker's URL (`?build=`),
 * so each deploy installs a fresh worker, which can clear the previous build's cache. Registered once
 * the page has loaded, so it never competes with the first render. A failure is silent: the application
 * works the same without a worker.
 */
export function registerServiceWorker(options: ServiceWorkerOptions = {}): void {
  if (options.enabled === false || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  const url = options.url ?? "/sw.js";
  const build = encodeURIComponent(currentBuildEntry() ?? "unknown");
  const register = () => {
    navigator.serviceWorker.register(`${url}${url.includes("?") ? "&" : "?"}build=${build}`).catch(() => {});
  };

  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
