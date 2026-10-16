// The client half of an installable web app: the browser's install prompt and the service worker's registration.
// The worker itself (its caching, its offline page) stays the application's own file.
//
//   captureInstallPrompt();                                          // once, at start-up: the event fires early
//   registerServiceWorker({ enabled: import.meta.env.PROD });        // a worker would cache the dev server's modules
//   const { canInstall, install } = useInstallPrompt();              // in a component: a button that opens the dialog
//   <AndroidInstallBanner app-name="Helpdesk" @close="…" />          // Android: one tap opens the system's dialog
//   <IosInstallGuide app-name="Helpdesk" @close="…" />               // iPhone: the three taps to the home screen
//   <InstallQrSheet v-model:open="qrOpen" app-name="Helpdesk" />     // the QR code of the address, for the phone
export { captureInstallPrompt, currentPlatform, isStandalone, useInstallPrompt, type AppPlatform } from "./install";
export { registerServiceWorker, type ServiceWorkerOptions } from "./worker";
export { default as AndroidInstallBanner } from "./AndroidInstallBanner.vue";
export { default as InstallQrSheet } from "./InstallQrSheet.vue";
export { default as IosInstallGuide } from "./IosInstallGuide.vue";
export { default as QrCode } from "./QrCode.vue";
