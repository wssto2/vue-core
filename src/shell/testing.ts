// Fixtures for this folder's tests; the declaration build excludes it.
import { afterEach } from "vitest";
import { defineComponent, h, type Component } from "vue";
import { createApplication, type Application, type ApplicationOptions, type ShellDefinition } from "../app";
import { defineFeature, type Feature } from "../app/feature";
import { fakeBackend, options, page, settle, signedIn } from "../app/testing";
import type { SessionSnapshot } from "../platform";

export { page, settle, signedIn };

const running: { application: Application; target: HTMLElement }[] = [];
afterEach(() => {
  for (const { application, target } of running.splice(0)) {
    application.dispose();
    target.remove();
  }
});

/** The routes every shell test needs: a public login page and a home page. */
export const baseFeature = defineFeature({
  id: "base",
  routes: [
    { name: "login", path: "/login", component: page("login page"), meta: { public: true } },
    { name: "home", path: "/", component: page("home page"), meta: { titleKey: "home.title" } },
    { name: "other", path: "/other", component: page("other page") },
    { name: "admin", path: "/admin", component: page("admin page"), meta: { access: "admin:view" } },
  ],
});

export interface Started {
  application: Application;
  target: HTMLElement;
  backend: ReturnType<typeof fakeBackend>["backend"];
  platform: ReturnType<typeof fakeBackend>["platform"];
}

/** Builds an application around `shell`, mounts it in the document and waits until it has settled. */
export async function startShell(shell: Component | ShellDefinition, settings: {
  features?: readonly Feature[];
  location?: string;
  session?: SessionSnapshot | null;
  extra?: Partial<ApplicationOptions>;
  /** Steers the fake backend before the application starts. */
  prepare?: (backend: ReturnType<typeof fakeBackend>["backend"]) => void;
} = {}): Promise<Started> {
  const { platform, backend } = fakeBackend(settings.session === undefined ? signedIn(1) : settings.session);
  settings.prepare?.(backend);
  const application = createApplication(options(platform, [baseFeature, ...(settings.features ?? [])], settings.location ?? "/", { shell, ...settings.extra }));
  const target = document.createElement("div");
  document.body.append(target);
  running.push({ application, target });
  await application.mount(target);
  await settle();
  return { application, target, backend, platform };
}

/** A component that renders one element with `text`: a stand-in for a feature's contribution. */
export const label = (text: string, tag = "button"): Component => defineComponent({ render: () => h(tag, text) });
