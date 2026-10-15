// The client half of an installable web app: the browser's install prompt and the service worker's registration.
// The worker itself (its caching, its offline page) stays the application's own file.
//
//   captureInstallPrompt();                                          // once, at start-up: the event fires early
//   registerServiceWorker({ enabled: import.meta.env.PROD });        // a worker would cache the dev server's modules
//   const { canInstall, install } = useInstallPrompt();              // in a component: a button that opens the dialog
export { captureInstallPrompt, currentPlatform, isStandalone, useInstallPrompt, type AppPlatform } from "./install";
export { registerServiceWorker, type ServiceWorkerOptions } from "./worker";
