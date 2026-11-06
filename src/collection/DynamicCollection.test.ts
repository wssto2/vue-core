import { fireEvent, render, screen, within } from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";
import type { FormSchema } from "../form/dynamic/schema";
import { createTestI18n, mockMedia, testFormatting } from "../testing";
import DynamicCollection from "./DynamicCollection.vue";
import { fakeLoader, flush, page } from "./testing";

const schema: FormSchema = {
  fields: [
    { key: "title", kind: "text", label: "Title", translatable: true },
    { key: "slug", kind: "text", label: "Slug" },
    { key: "image", kind: "image", label: "Image" },
    { key: "published", kind: "boolean", label: "Published" },
    { key: "category", kind: "select", label: "Category", options: [{ value: "news", label: "News" }, { value: "events", label: "Events" }] },
    { key: "date", kind: "date", label: "Date" },
    { key: "body", kind: "rich_text", label: "Body" },
    { key: "slides", kind: "collection", label: "Slides", children: [] },
  ],
};
const ROWS = [
  { id: 1, title: { hr: "Vijesti", en: "News" }, slug: "vijesti", image: 7, published: true, category: "news", date: "2026-09-01" },
  { id: 2, title: { en: "Only English" }, slug: "en", image: null, published: false, category: "events", date: "2026-09-02" },
];

const i18n = createTestI18n({ locale: "hr" });
let restore = () => {};
beforeEach(() => {
  restore = mockMedia({ narrow: false }).restore;
});
afterEach(() => {
  restore();
  document.body.innerHTML = "";
});

async function mountList(props: Record<string, unknown> = {}, slots: Record<string, unknown> = {}) {
  const loader = fakeLoader((query) => page(ROWS as never, { page: query.page, total: ROWS.length }) as never);
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/news", component: { render: () => h("div") } },
      { path: "/news/:id", name: "entry", component: { render: () => h("div") } },
    ],
  });
  await router.push("/news");
  await router.isReady();
  const Host = defineComponent({
    setup: () => () => h("div", [h(DynamicCollection as never, { id: "content.news", schema, load: loader.load, title: "News", thumbnail: "/media/{id}/thumb", recordRoute: (row: { id: number }) => ({ name: "entry", params: { id: row.id } }), ...props } as never, slots as never), h(RouterView)]),
  });
  render(Host, { global: { plugins: [router, i18n, testFormatting(i18n)] } });
  await flush();
  return { loader, router };
}

describe("DynamicCollection", () => {
  it("makes a column per listable field and leaves out long text and nested rows", async () => {
    await mountList();
    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent?.trim());
    expect(headers.slice(0, 6)).toEqual(["Title", "Slug", "Image", "Published", "Category", "Date"]);
    expect(headers).not.toContain("Body");
    expect(headers).not.toContain("Slides");
  });

  it("draws the cells of each kind: the title links to the record in the current language, a boolean and a select are badges, an image is a picture", async () => {
    await mountList();
    const rows = screen.getAllByRole("row").slice(1);
    const first = within(rows[0]!);
    expect(first.getByRole("link", { name: "Vijesti" }).getAttribute("href")).toMatch(/^\/news\/1/);
    expect(first.getByText("News")).toBeTruthy();
    expect(first.getByText("Da")).toBeTruthy();
    expect(within(rows[1]!).getByText("Ne")).toBeTruthy();
    expect(rows[0]!.querySelector("img")?.getAttribute("src")).toBe("/media/7/thumb");
    expect(rows[0]!.querySelector("time")).toBeTruthy();
    // a language the record lacks falls back to the first one written
    expect(within(rows[1]!).getByRole("link", { name: "Only English" })).toBeTruthy();
    expect(rows[1]!.querySelector("img")).toBeNull();
  });

  it("sorts by the fields the backend can order by, and not by translated text, images or lists", async () => {
    const { loader } = await mountList();
    const sortable = screen.getAllByRole("columnheader").filter((header) => header.getAttribute("aria-sort") !== null).map((header) => header.textContent?.trim());
    expect(sortable).toEqual(["Slug", "Published", "Category", "Date"]);

    await fireEvent.click(within(document.querySelector("thead")!).getByRole("button", { name: /Date/ }));
    await flush();
    expect(loader.calls.at(-1)?.query.sort).toBe("date");
  });

  it("offers a filter per select, boolean and date field, and sends the chosen value", async () => {
    const { loader } = await mountList();
    const capsules = [...document.querySelectorAll("[data-menu-trigger]")].map((button) => button.textContent?.trim());
    expect(capsules).toEqual(["Published", "Category", "Date"]);

    await fireEvent.click([...document.querySelectorAll("[data-menu-trigger]")][1]!);
    await fireEvent.click(await screen.findByRole("menuitemradio", { name: "Events" }));
    await flush();
    expect(loader.calls.at(-1)?.query.filters).toEqual({ category: "events" });
  });

  it("shows only the columns it is told to, in that order", async () => {
    await mountList({ columns: ["category", "title"] });
    expect(screen.getAllByRole("columnheader").slice(0, 2).map((header) => header.textContent?.trim())).toEqual(["Category", "Title"]);
  });

  it("lets a cell slot replace a column", async () => {
    await mountList({}, { "cell-slug": ({ item }: { item: { slug: string } }) => h("b", { "data-test": "slug" }, `/${item.slug}`) });
    expect(document.querySelectorAll("[data-test='slug']")).toHaveLength(2);
  });
});
