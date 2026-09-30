import { defineComponent, onScopeDispose } from "vue";
import { useI18n } from "vue-i18n";
import { defineFeature, type Feature } from "../app/feature";
import { toast } from "../overlay";

export interface AppUpdatesOptions {
  /** The page the server serves the application from; its module scripts say which build is live. Default `/`. */
  url?: string;
  /** How often to look while the application is visible. Default 30 minutes. */
  checkEveryMs?: number;
  /** Default true. Pass false where there is nothing to update (development). */
  enabled?: boolean;
}

const DEFAULT_EVERY_MS = 30 * 60_000;
/** Coming back to the foreground more often than this does not ask the server again. */
const MIN_GAP_MS = 60_000;

/** The module scripts a page loads, by path and sorted: the identity of a build (its entry is hashed, so a deploy changes it). */
export function moduleScripts(html: string, base: string): string[] {
  const scripts = new DOMParser().parseFromString(html, "text/html").querySelectorAll<HTMLScriptElement>('script[type="module"][src]');
  return Array.from(scripts, (script) => new URL(script.getAttribute("src") ?? "", base).pathname).sort();
}

/** The module scripts of the page that is running now. */
export function loadedModuleScripts(): string[] {
  return Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'), (script) => new URL(script.src, location.href).pathname).sort();
}

/**
 * What `appUpdates()` mounts. "A new version is available" for an application that stays open for
 * days (an installed app is rarely reloaded): when the live page names other module scripts than
 * the ones running, a deploy happened since this copy loaded, and the user is offered a reload.
 * Checked when the application comes back to the foreground and on a timer while it is visible.
 */
function createNotice(options: AppUpdatesOptions) {
  return defineComponent({
    name: "AppUpdateNotice",
    setup() {
      if (options.enabled === false) return () => null;

      const { t } = useI18n();
      const url = options.url ?? "/";
      const current = loadedModuleScripts();
      let offered = false;
      let lastCheck = 0;

      async function check() {
        if (offered || current.length === 0 || !navigator.onLine || document.visibilityState !== "visible") return;
        if (Date.now() - lastCheck < MIN_GAP_MS) return;
        lastCheck = Date.now();

        try {
          const response = await fetch(url, { cache: "no-store", credentials: "include" });
          // An error page or a sign-in redirect names no scripts: that is not a new build.
          const latest = response.ok ? moduleScripts(await response.text(), location.href) : [];
          if (latest.length === 0 || latest.join() === current.join()) return;

          offered = true;
          toast.info(t("core.shell.update.available"), {
            duration: Infinity,
            action: { label: t("core.shell.update.reload"), onClick: () => location.reload() },
          });
        } catch {
          // Offline or the server is restarting: try again on the next check.
        }
      }

      const onVisible = () => void check();
      document.addEventListener("visibilitychange", onVisible);
      const timer = setInterval(check, options.checkEveryMs ?? DEFAULT_EVERY_MS);
      onScopeDispose(() => {
        document.removeEventListener("visibilitychange", onVisible);
        clearInterval(timer);
      });
      return () => null;
    },
  });
}

/**
 * Offers a reload when a new build of the application has been deployed, as an opt-in feature:
 *
 *   createApplication({ platform, features: [identity, tickets, appUpdates({ enabled: import.meta.env.PROD })], shell: backofficeShell() })
 *
 * It mounts in the shell's `host` slot and needs the `Toaster` the backoffice shell renders.
 */
export function appUpdates(options: AppUpdatesOptions = {}): Feature {
  return defineFeature({
    id: "vue-core.app-updates",
    contributions: [{ id: "vue-core.app-updates", slot: "host", component: createNotice(options), scope: "always" }],
  });
}
