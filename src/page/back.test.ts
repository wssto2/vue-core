import { render } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import AdaptivePageShell from "./AdaptivePageShell.vue";
import { useBackLinks } from "./back";
import { createPageChrome, pageChromeKey } from "./chrome";

const i18n = createTestI18n({ messages: { en: { vehicles: { takeover: "Takeover" }, contracts: { title: "Contracts" } } } });
const view = defineComponent({ render: () => h("div") });

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/contracts", name: "contracts", component: view, meta: { titleKey: "contracts.title" } },
      { path: "/contracts/new", name: "contracts.new", component: view },
      { path: "/contracts/:id", name: "contract", component: view },
      { path: "/takeovers/7", name: "takeover", component: view, meta: { titleKey: "vehicles.takeover" } },
      { path: "/untitled", name: "untitled", component: view },
      { path: "/:rest(.*)*", name: "not-found", component: view },
    ],
  });
}

afterEach(() => {
  document.body.innerHTML = "";
});

async function mountShell(path: string, props: Record<string, unknown> = {}) {
  const router = makeRouter();
  await router.push(path);
  const chrome = createPageChrome();
  render(AdaptivePageShell, {
    props: { title: "Contract", back: { label: "Own list", to: "/contracts" }, ...props },
    slots: { default: "<p>Content</p>" },
    global: { plugins: [i18n, testFormatting(i18n), router], stubs: { transition: false }, provide: { [pageChromeKey as symbol]: chrome } },
  });
  await nextTick();
  const back = document.querySelector<HTMLAnchorElement>("[data-page-toolbar] [data-page-back]")!;
  return { chrome, back, router };
}

const enc = (value: string) => encodeURIComponent(value).replace(/%2F/g, "/"); // vue-router writes a slash in a query value as it is

describe("the page back through ?back=", () => {
  it("replaces the page's own back with the origin's path and the carried name", async () => {
    const { back, chrome } = await mountShell(`/contracts/new?back=${enc("/takeovers/7?x=1")}&back_title=${enc("Golf 1.6 TDI")}`);
    expect(back.textContent?.trim()).toBe("Golf 1.6 TDI");
    expect(back.getAttribute("href")).toBe("/takeovers/7?x=1");
    // The phone nav bar reads the same one.
    expect(chrome.back.value).toEqual({ label: "Golf 1.6 TDI", to: "/takeovers/7?x=1" });
  });

  it("falls back to the target route's titleKey without a carried name, and for an empty one", async () => {
    expect((await mountShell(`/contracts/new?back=${enc("/takeovers/7")}`)).back.textContent?.trim()).toBe("Takeover");
    document.body.innerHTML = "";
    expect((await mountShell(`/contracts/new?back=${enc("/takeovers/7")}&back_title=%20%20`)).back.textContent?.trim()).toBe("Takeover");
  });

  it("shows the name as text, trimmed and capped at 80 characters", async () => {
    const { back } = await mountShell(`/contracts/new?back=${enc("/takeovers/7")}&back_title=${enc(`  <b>x</b>${"a".repeat(100)}`)}`);
    expect(back.querySelector("b")).toBeNull();
    const label = back.textContent?.trim() ?? "";
    expect(label.length).toBe(80);
    expect(label.startsWith("<b>x</b>aaa")).toBe(true);
    expect(label.endsWith("…")).toBe(true);
  });

  it.each([
    ["an external URL", "https://evil.example/x"],
    ["a protocol-relative URL", "//evil.example/x"],
    ["a backslash host", "/\\evil.example"],
    ["a relative path", "takeovers/7"],
    ["a javascript URL", "javascript:alert(1)"],
    ["a path no route knows (only the catch-all)", "/nowhere/at/all"],
    ["the current page", "/contracts/new"],
  ])("ignores %s and keeps the page's own back", async (_name, value) => {
    const { back, chrome } = await mountShell(`/contracts/new?back=${enc(value)}&back_title=Hello`);
    expect(back.textContent?.trim()).toBe("Own list");
    expect(chrome.back.value?.to).toBe("/contracts");
  });

  it("ignores a back with neither a name nor a titleKey", async () => {
    const { back } = await mountShell(`/contracts/new?back=${enc("/untitled")}`);
    expect(back.textContent?.trim()).toBe("Own list");
  });

  it("leaves a page without ?back= alone", async () => {
    const { back } = await mountShell("/contracts/new");
    expect(back.textContent?.trim()).toBe("Own list");
  });
});

describe("useBackLinks", () => {
  async function mountPage(path: string) {
    const router = makeRouter();
    await router.push(path);
    const chrome = createPageChrome();
    const owner = chrome.claim();
    let links!: ReturnType<typeof useBackLinks>;
    const Page = defineComponent({
      setup() {
        links = useBackLinks();
        return () => h("div");
      },
    });
    render(Page, { global: { plugins: [i18n, router], provide: { [pageChromeKey as symbol]: chrome } } });
    return { links, owner, router };
  }

  it("backHere carries this page and its name, and follows the name once the record has loaded", async () => {
    const { links, owner, router } = await mountPage("/takeovers/7?tab=1");
    const before = router.resolve(links.backHere({ name: "contracts.new" }));
    expect(before.path).toBe("/contracts/new");
    expect(before.query).toEqual({ back: "/takeovers/7?tab=1" });

    owner.setTitle("Golf 1.6 TDI");
    expect(router.resolve(links.backHere({ name: "contracts.new" })).query).toEqual({ back: "/takeovers/7?tab=1", back_title: "Golf 1.6 TDI" });
  });

  it("backHere takes a path string, keeping its query and hash", async () => {
    const { links, owner, router } = await mountPage("/takeovers/7");
    owner.setTitle("Golf");
    expect(router.resolve(links.backHere("/contracts/new?exchange_vehicle_id=7#top")).fullPath).toBe(`/contracts/new?exchange_vehicle_id=7&back=${enc("/takeovers/7")}&back_title=Golf#top`);
  });

  it("keepBack carries both parameters, and leaves a page opened any other way alone", async () => {
    const opened = await mountPage(`/contracts/new?back=${enc("/takeovers/7")}&back_title=Golf`);
    expect(opened.router.resolve(opened.links.keepBack({ name: "contract", params: { id: 31 } })).fullPath).toBe(`/contracts/31?back=${enc("/takeovers/7")}&back_title=Golf`);
    const plain = await mountPage("/contracts/new");
    expect(plain.links.keepBack({ name: "contract", params: { id: 31 } })).toEqual({ name: "contract", params: { id: 31 } });
  });
});
