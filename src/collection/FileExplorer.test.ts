import { fireEvent, render, screen, within } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, ref } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { createTestI18n, testFormatting } from "../testing";
import type { PageAction } from "../page/types";
import FileExplorer from "./FileExplorer.vue";
import type { ExplorerRow } from "./explorer";
import { flush } from "./testing";

interface Entry extends ExplorerRow {
  readonly url?: string;
}
const ROWS: Entry[] = [
  { id: 1, kind: "folder", name: "Usluge" },
  { id: 2, kind: "page", name: "Naslovnica", url: "/" },
  { id: 3, kind: "page", name: "Kontakt", url: "/kontakt" },
  { id: 4, kind: "link", name: "Webshop", url: "https://shop.example" },
];
const columns = [{ key: "url", label: "URL" }] as const;
const i18n = createTestI18n();

afterEach(() => (document.body.innerHTML = ""));

async function mount(options: { router?: boolean; initial?: string; param?: string | null } = {}) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/pages", component: { render: () => h("div") } }] });
  await router.push(options.initial ?? "/pages");
  await router.isReady();
  const selected = ref<(string | number)[]>([]);
  const folder = ref<string | null>(null);
  const opened: Entry[] = [];
  const batch: PageAction[] = [{ id: "delete", label: "Obriši", tone: "critical", onClick: () => undefined }, { id: "copy", label: "Kopiraj", onClick: () => undefined }];
  const Host = defineComponent({
    setup: () => () =>
      h(FileExplorer as never, {
        rows: ROWS, columns, label: "Stranice", selected: selected.value, folder: folder.value, param: options.param,
        "onUpdate:selected": (next: (string | number)[]) => (selected.value = next),
        "onUpdate:folder": (next: string | null) => (folder.value = next),
        onOpen: (row: Entry) => opened.push(row),
        breadcrumb: [{ id: null, label: "/" }, { id: "1", label: "Usluge" }],
        selectionActions: () => batch,
        rowActions: (row: Entry) => [{ key: "rename", label: `Preimenuj ${row.name}`, icon: "edit", onSelect: () => undefined }],
      } as never, { toolbar: () => h("button", "Novo") }),
  });
  const view = render(Host, { global: { plugins: options.router === false ? [i18n, testFormatting(i18n)] : [router, i18n, testFormatting(i18n)] } });
  await flush();
  return { ...view, router, selected, folder, opened };
}

describe("FileExplorer", () => {
  it("lists the rows with the app's columns, and shows no selection bar until a row is ticked", async () => {
    await mount();
    expect(document.querySelectorAll("[data-test=explorer-row]")).toHaveLength(4);
    expect(screen.getByText("/kontakt")).toBeTruthy();
    expect(document.querySelector("[data-test=selection-bar]")).toBeNull();
    expect(document.querySelector("[data-kind=folder]")?.querySelector("svg path")?.getAttribute("d")).toMatch(/^M4 5V19H20V7/); // a folder row has the folder icon
  });

  it("shows the selection bar with labelled actions while rows are ticked, and removes it when they are not", async () => {
    const { selected } = await mount();
    await fireEvent.click(screen.getByRole("checkbox", { name: "Select Kontakt" }));
    await fireEvent.click(screen.getByRole("checkbox", { name: "Select Webshop" }));
    const bar = screen.getByRole("region", { name: "Selected items" });
    expect(within(bar).getByRole("status").textContent).toBe("2 selected");
    expect(within(bar).getByRole("button", { name: "Obriši" })).toBeTruthy();
    expect(within(bar).getByRole("button", { name: "Kopiraj" })).toBeTruthy();
    expect(selected.value).toEqual([3, 4]);
    await fireEvent.click(within(bar).getByRole("button", { name: "Clear selection" }));
    expect(selected.value).toEqual([]);
    expect(screen.queryByRole("region", { name: "Selected items" })).toBeNull();
  });

  it("the header box ticks every row, and a partial selection is indeterminate", async () => {
    await mount();
    const all = screen.getByRole("checkbox", { name: "Select all" }) as HTMLInputElement;
    await fireEvent.click(screen.getByRole("checkbox", { name: "Select Kontakt" }));
    expect(all.indeterminate).toBe(true);
    await fireEvent.click(all);
    expect(document.querySelectorAll("tbody input:checked")).toHaveLength(4);
    await fireEvent.click(all);
    expect(document.querySelectorAll("tbody input:checked")).toHaveLength(0);
  });

  it("opens pages, links and files with @open; a folder walks instead", async () => {
    const { opened, folder, router } = await mount();
    await fireEvent.click(screen.getByRole("button", { name: "Kontakt" }));
    expect(opened.map((row) => row.id)).toEqual([3]);
    await fireEvent.click(screen.getByRole("button", { name: /^Usluge/ }));
    await flush();
    expect(opened).toHaveLength(1);
    expect(folder.value).toBe("1");
    expect(router.currentRoute.value.query.folder).toBe("1");
  });

  it("a row click opens it, but a click on its own controls does not", async () => {
    const { opened } = await mount();
    await fireEvent.click(document.querySelectorAll("[data-test=explorer-row]")[1]!.querySelectorAll("td")[2]!);
    expect(opened.map((row) => row.id)).toEqual([2]);
    await fireEvent.click(screen.getByRole("checkbox", { name: "Select Naslovnica" }));
    expect(opened).toHaveLength(1);
  });

  it("reads the folder from the URL, follows Back, and clears the selection on a change", async () => {
    const { folder, router, selected } = await mount({ initial: "/pages?folder=7" });
    expect(folder.value).toBe("7");
    await fireEvent.click(screen.getByRole("checkbox", { name: "Select Kontakt" }));
    expect(selected.value).toEqual([3]);
    await router.push("/pages");
    await flush();
    expect(folder.value).toBeNull();
    expect(selected.value).toEqual([]);
  });

  it("the breadcrumb walks up: a step sets the folder and the URL, the last one is the current place", async () => {
    const { folder, router } = await mount({ initial: "/pages?folder=1" });
    const nav = screen.getByRole("navigation", { name: "Path" });
    expect(within(nav).getByText("Usluge").getAttribute("aria-current")).toBe("page");
    await fireEvent.click(within(nav).getByRole("button", { name: "/" }));
    await flush();
    expect(folder.value).toBeNull();
    expect(router.currentRoute.value.query.folder).toBeUndefined();
  });

  it("keeps the folder out of the URL with param=null, and works without a router", async () => {
    const { folder, router } = await mount({ param: null });
    await fireEvent.click(screen.getByRole("button", { name: /^Usluge/ }));
    expect(folder.value).toBe("1");
    expect(router.currentRoute.value.query.folder).toBeUndefined();
    document.body.innerHTML = "";
    const bare = await mount({ router: false });
    await fireEvent.click(screen.getByRole("button", { name: /^Usluge/ }));
    expect(bare.folder.value).toBe("1");
  });

  it("gives each row a labelled More menu with its actions", async () => {
    await mount();
    await fireEvent.click(screen.getByRole("button", { name: "More actions: Kontakt" }));
    expect(await screen.findByRole("menuitem", { name: "Preimenuj Kontakt" })).toBeTruthy();
  });
});
