import { fireEvent, screen, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { defineFeature } from "../app";
import { Modal } from "../modal";
import { deferred } from "../testing/async";
import { mockMedia } from "../testing/media";
import { backofficeShell } from "./backofficeShell";
import { quickSearch } from "./quickSearch";
import { useQuickSearch, type QuickSearchAnswer, type QuickSearchOptions } from "./quickSearchControl";
import { settle, startShell, stopShells } from "./testing";

let media: ReturnType<typeof mockMedia> | null = null;
afterEach(() => {
  stopShells();
  media?.restore();
  media = null;
});

const answer = (...titles: string[]): QuickSearchAnswer => ({
  groups: [{ key: "people", label: "People", rows: titles.map((title, index) => ({ key: `p${index}`, title, meta: `ID ${index}`, icon: "user3Line", to: { name: "other" } })) }],
});

async function start(options: Partial<QuickSearchOptions> = {}, extra: Parameters<typeof defineFeature>[0][] = []) {
  media = mockMedia({ narrow: false });
  const search = vi.fn<QuickSearchOptions["search"]>(async () => answer("Ana Horvat", "Ivo Kovač"));
  await startShell(backofficeShell(), { features: [quickSearch({ search, delayMs: 5, ...options }), ...extra.map(defineFeature)] });
  return { search };
}

const palette = () => document.querySelector<HTMLElement>("[data-test='quick-search']");
const field = () => screen.getByRole("combobox");
const type = async (text: string) => fireEvent.update(field(), text);
const rows = () => [...document.querySelectorAll<HTMLElement>("[role='option']")];
const ctrlK = () => fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });

describe("quickSearch", () => {
  it("opens from the field in the sidebar and from Ctrl+K, and Escape closes it", async () => {
    await start();
    expect(palette()).toBeNull();

    await fireEvent.click(document.querySelector("[data-test='quick-search-button']")!);
    await settle();
    expect(palette()).not.toBeNull();

    await fireEvent.keyDown(palette()!, { key: "Escape" });
    await vi.waitFor(() => expect(palette()).toBeNull());

    await ctrlK();
    await settle();
    expect(palette()).not.toBeNull();
  });

  it("searches after a pause, with the trimmed text, and marks the matched words", async () => {
    const { search } = await start();
    await ctrlK();
    await settle();
    await type("  ana ");

    await vi.waitFor(() => expect(rows()).toHaveLength(2));
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0]![0]).toBe("ana");
    expect(search.mock.calls[0]![1]).toBeInstanceOf(AbortSignal);
    expect(document.querySelector("mark")!.textContent).toBe("Ana");
    expect(screen.getByText("People")).toBeTruthy();
  });

  it("waits for the minimum length", async () => {
    const { search } = await start();
    await ctrlK();
    await settle();
    await type("a");
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(search).not.toHaveBeenCalled();
    expect(screen.getByText("Type to search.")).toBeTruthy();
  });

  it("moves with the arrows and opens the active row with Enter", async () => {
    await start();
    await ctrlK();
    await settle();
    await type("an");
    await vi.waitFor(() => expect(rows()).toHaveLength(2));

    await fireEvent.keyDown(palette()!, { key: "ArrowDown" });
    expect(rows()[1]!.getAttribute("aria-selected")).toBe("true");
    await fireEvent.keyDown(palette()!, { key: "Enter" });

    await vi.waitFor(() => expect(screen.getByText("other page")).toBeTruthy());
    expect(palette()).toBeNull();
  });

  it("lets the app remember a chosen row and offers the recent ones before anything is typed", async () => {
    const onChoose = vi.fn();
    const recent = answer("Marko Marić").groups[0]!.rows;
    await start({ onChoose, recent: () => recent });
    await ctrlK();
    await settle();

    expect(screen.getByText("Recently opened")).toBeTruthy();
    await fireEvent.click(rows()[0]!);
    expect(onChoose).toHaveBeenCalledWith(recent[0]);
  });

  it("says nothing was found but still shows the suggestions", async () => {
    await start({
      search: async () => ({ groups: [] }),
      suggest: (query) => [{ key: "actions", label: "Actions", rows: [{ key: "enter", title: `Enter ${query}`, icon: "search", tile: "action", to: { name: "other" } }] }],
      noneHint: "Searches names.",
    });
    await ctrlK();
    await settle();
    await type("zzz");

    await vi.waitFor(() => expect(screen.getByText("Nothing for “zzz”")).toBeTruthy());
    expect(screen.getByText("Searches names.")).toBeTruthy();
    expect(rows().map((row) => row.textContent)).toEqual([expect.stringContaining("Enter zzz")]);
  });

  it("drops the answer of an older query and says so when some groups could not be searched", async () => {
    const slow = deferred<QuickSearchAnswer>();
    const search = vi.fn<QuickSearchOptions["search"]>()
      .mockImplementationOnce(() => slow.promise)
      .mockResolvedValueOnce({ groups: answer("Newest").groups, unavailable: ["Contracts"] });
    await start({ search });
    await ctrlK();
    await settle();

    await type("old");
    await vi.waitFor(() => expect(search).toHaveBeenCalledTimes(1));
    await type("new");
    await vi.waitFor(() => expect(rows().map((row) => row.textContent)).toEqual([expect.stringContaining("Newest")]));
    slow.resolve(answer("Stale"));
    await settle();

    expect(rows()).toHaveLength(1);
    expect((search.mock.calls[0]![1] as AbortSignal).aborted).toBe(true);
    expect(screen.getByText("Some results are unavailable right now: Contracts.")).toBeTruthy();
  });

  it("says so when the search fails", async () => {
    await start({ search: async () => { throw new Error("down"); } });
    await ctrlK();
    await settle();
    await type("abc");

    await vi.waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Search is not working right now"));
  });

  it("does not open over a dialog that is already open", async () => {
    const dialog = ref<InstanceType<typeof Modal> | null>(null);
    const Host = defineComponent({ setup: () => () => h(Modal, { ref: dialog, title: "Other dialog" }, () => "inside") });
    await start({}, [{ id: "dialog", contributions: [{ id: "dialog", slot: "host", component: Host, scope: "authenticated" }] }]);
    dialog.value!.present();
    await settle();

    await ctrlK();
    await settle();
    expect(palette()).toBeNull();
    expect(within(document.body).getByText("inside")).toBeTruthy();
  });

  it("can be opened from a trigger of the app", async () => {
    let control!: ReturnType<typeof useQuickSearch>;
    const Trigger = defineComponent({ setup() { control = useQuickSearch(); return () => h("span", "trigger"); } });
    await start({}, [{ id: "trigger", contributions: [{ id: "trigger", slot: "headerActions", component: Trigger, scope: "authenticated" }] }]);
    control.open();
    await settle();

    expect(palette()).not.toBeNull();
  });
});
