// Fixtures for this folder's tests; the declaration build excludes it.
import { createApp, defineComponent, h, type Plugin } from "vue";
import { createTestI18n } from "../testing/i18n";

/** Runs a composable inside a mounted component (with the library's texts), for tests. */
export function withSetup<T>(setup: () => T, plugins: Plugin[] = []): { result: T; unmount: () => void } {
  let result!: T;
  const app = createApp(
    defineComponent({
      setup() {
        result = setup();
        return () => h("div");
      },
    }),
  );
  app.use(createTestI18n("en"));
  for (const plugin of plugins) app.use(plugin);
  const host = document.createElement("div");
  app.mount(host);
  return { result, unmount: () => app.unmount() };
}

/** Lets pending promises and watchers settle. */
export const settle = async () => {
  for (let index = 0; index < 5; index++) await new Promise((resolve) => setTimeout(resolve, 0));
};
