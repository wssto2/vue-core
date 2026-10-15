import { computed, ref, shallowRef } from "vue";

/**
 * Installing the application. Chrome and Edge (Android and desktop) offer it with `beforeinstallprompt`,
 * which fires once, early: `captureInstallPrompt()` runs at start-up and keeps the event, so a button
 * later can open the browser's own dialog with one tap. Safari has no such API (on an iPhone only the
 * share sheet adds to the home screen), so there the application can only show the way.
 */
type InstallPromptEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

// Module state on purpose: the event fires before any component exists, and there is one per page.
const deferred = shallowRef<InstallPromptEvent | null>(null);
const installed = ref(false);
let captured = false;

/** Starts listening for the install prompt. Safe to call twice; does nothing without a `window`. */
export function captureInstallPrompt(): void {
  if (captured || typeof window === "undefined") return;
  captured = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred.value = event as InstallPromptEvent;
  });
  window.addEventListener("appinstalled", () => {
    installed.value = true;
    deferred.value = null;
  });
}

export type AppPlatform = "ios" | "android" | "desktop";

export function currentPlatform(): AppPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  // iPadOS asks for the desktop site: a "Mac" with a touch screen is an iPad.
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return "desktop";
}

/** Opened from the home screen or as an installed app, not in a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches === true
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function useInstallPrompt() {
  return {
    canInstall: computed(() => deferred.value != null),
    installed: computed(() => installed.value || isStandalone()),
    /** Opens the browser's install dialog; true when the user accepted. */
    async install(): Promise<boolean> {
      const event = deferred.value;
      if (!event) return false;
      await event.prompt();
      const { outcome } = await event.userChoice;
      deferred.value = null;
      if (outcome === "accepted") installed.value = true;
      return outcome === "accepted";
    },
  };
}
