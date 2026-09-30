import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";
import { AdaptivePageShell, usePageChrome } from "../page";
import { createApplication, type Application } from "./application";
import { defineFeature } from "./feature";
import { fakeBackend, options, page, settle, signedIn } from "./testing";

const mounted: Application[] = [];
afterEach(() => {
  for (const application of mounted.splice(0)) application.dispose();
  document.body.innerHTML = "";
});

const messages = { en: { tickets: { title: "Tickets" } } };
const loginFeature = defineFeature({ id: "login", routes: [{ name: "login", path: "/login", component: page("login"), meta: { public: true } }] });

async function open(record: ReturnType<typeof defineComponent>, location = "/tickets/7") {
  const feature = defineFeature({
    id: "tickets",
    routes: [
      { name: "tickets.index", path: "/tickets", component: page("list"), meta: { titleKey: "tickets.title" } },
      { name: "tickets.record", path: "/tickets/:id", component: record, meta: { titleKey: "tickets.title" } },
    ],
  });
  const { platform } = fakeBackend(signedIn(1));
  const application = createApplication(options(platform, [loginFeature, feature], location, { i18n: { messages, missingWarn: false } }));
  mounted.push(application);
  const target = document.body.appendChild(document.createElement("div"));
  await application.mount(target);
  await settle();
  return application;
}

describe("the browser tab title of a record page", () => {
  it("is the record's name once it is known, in the app's title format, and the route's title again when the page is left", async () => {
    const name = ref("Ticket");
    const record = defineComponent({ setup: () => () => h(AdaptivePageShell, { title: name.value, documentTitle: name.value }) });
    await open(record);
    expect(document.title).toBe("Ticket · Test app");

    name.value = "Printer on fire";
    await settle();
    expect(document.title).toBe("Printer on fire · Test app");

    const application = mounted[0]!;
    await application.router.push("/tickets");
    await settle();
    expect(document.title).toBe("Tickets · Test app");
  });

  it("does not show the name of the record page that was just left on the page that replaces it", async () => {
    const record = defineComponent({ setup: () => () => h(AdaptivePageShell, { title: "Printer on fire", documentTitle: "Printer on fire" }) });
    const application = await open(record);
    expect(document.title).toBe("Printer on fire · Test app");
    await application.router.push("/tickets");
    await settle();
    expect(document.title).toBe("Tickets · Test app");
  });

  it("follows a page that registers it through page chrome, and leaves the route's title to one that registers nothing", async () => {
    const title = ref<string | null>(null);
    const record = defineComponent({
      setup() {
        usePageChrome({ documentTitle: title });
        return () => null;
      },
    });
    await open(record);
    expect(document.title).toBe("Tickets · Test app");
    title.value = "Named";
    await settle();
    expect(document.title).toBe("Named · Test app");
    title.value = null;
    await settle();
    expect(document.title).toBe("Tickets · Test app");
  });
});
