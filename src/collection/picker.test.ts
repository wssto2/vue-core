import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { mockMedia } from "../testing/media";
import { createTestI18n } from "../testing/i18n";
import { testFormatting } from "../testing/format";
import { listPage } from "../testing/collection";
import CollectionTable from "./CollectionTable.vue";
import type { CollectionColumns } from "./columns";
import { defineCollection } from "./definition";
import { createPicker, type PickerOptions } from "./picker";
import PickerModal from "./PickerModal.vue";
import { fakeLoader, flush } from "./testing";
import { useCollection } from "./useCollection";

interface Person {
  readonly id: number;
  readonly name: string;
}
const PEOPLE: Person[] = [{ id: 1, name: "Ana Horvat" }, { id: 2, name: "Ivo Kovač" }];

const i18n = createTestI18n();
let restore = () => {};
afterEach(() => {
  restore();
  document.body.innerHTML = "";
});

describe("createPicker", () => {
  it("resolves with the chosen row, or null when cancelled, and closes either way", async () => {
    const picker = createPicker<Person>();
    expect(picker.state.value.open).toBe(false);

    const chosen = picker.pick();
    expect(picker.state.value.open).toBe(true);
    picker.select(PEOPLE[0]!);
    expect(await chosen).toBe(PEOPLE[0]);
    expect(picker.state.value.open).toBe(false);

    const dismissed = picker.pick();
    picker.cancel();
    expect(await dismissed).toBeNull();
  });

  it("hands the options to the dialog and answers the earlier call with null when asked again", async () => {
    const picker = createPicker<Person, PickerOptions & { locationId: number }>();
    const first = picker.pick({ locationId: 1 });
    const second = picker.pick({ locationId: 2 });

    expect(await first).toBeNull();
    expect(picker.state.value.options).toEqual({ locationId: 2 });
    picker.select(PEOPLE[1]!);
    expect(await second).toBe(PEOPLE[1]);
  });

  it("ignores a choice or a cancel when nothing is open", () => {
    const picker = createPicker<Person>();
    picker.cancel();
    picker.select(PEOPLE[0]!);
    expect(picker.state.value.open).toBe(false);
  });
});

describe("PickerModal", () => {
  async function mountPicker() {
    restore = mockMedia({ narrow: false }).restore;
    const picker = createPicker<Person, PickerOptions & { search?: string }>();
    const loader = fakeLoader<Person>(() => listPage(PEOPLE));
    const definition = defineCollection({ id: "people", stateVersion: 1, load: loader.load as never, key: (person: Person) => person.id, query: { sorts: [], filters: [] } });
    const columns = [{ key: "name", label: "Name", kind: "identity", mobile: "primary" }] satisfies CollectionColumns<Person>;
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/", component: { render: () => h("div") } }] });
    await router.push("/");
    await router.isReady();

    const List = defineComponent({
      props: { onPick: { type: Function, required: true } },
      setup(props) {
        const people = useCollection(definition as never, { columns: columns as never, state: { kind: "memory" } }) as never;
        return () => h(CollectionTable as never, { collection: people, pick: props.onPick } as never);
      },
    });
    const Host = defineComponent({
      setup: () => () => h(PickerModal as never, { picker, title: "Assign a person" } as never, { default: ({ select }: { select: (person: Person) => void }) => h(List, { onPick: select }) }),
    });
    render(Host, { global: { plugins: [router, i18n, testFormatting(i18n)] } });
    await flush();
    return { picker, loader };
  }

  const dialog = () => document.querySelector("[role='dialog']");

  it("is closed until something picks, and does not ask for the list before", async () => {
    const { loader } = await mountPicker();
    expect(dialog()).toBeNull();
    expect(loader.calls).toHaveLength(0);
  });

  it("opens with the title and resolves with the row that was chosen in the list", async () => {
    const { picker } = await mountPicker();
    const result = picker.pick();
    await flush();

    expect(dialog()).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Assign a person" })).toBeTruthy();
    await fireEvent.click(await screen.findByText("Ivo Kovač"));

    expect(await result).toEqual(PEOPLE[1]);
    await flush();
    expect(picker.state.value.open).toBe(false);
  });

  it("lets the call name the dialog", async () => {
    const { picker } = await mountPicker();
    void picker.pick({ title: "Pick the owner", description: "Only active people" });
    await flush();

    expect(screen.getByRole("heading", { name: "Pick the owner" })).toBeTruthy();
    expect(screen.getByText("Only active people")).toBeTruthy();
  });

  it("answers null when the person dismisses it with Escape, and opens again afterwards", async () => {
    const { picker } = await mountPicker();
    const first = picker.pick();
    await flush();
    await fireEvent.keyDown(dialog()!, { key: "Escape" });

    expect(await first).toBeNull();
    await flush();
    await closed();

    const second = picker.pick();
    await flush();
    expect(dialog()).not.toBeNull();
    await fireEvent.keyDown(dialog()!, { key: "Escape" });
    expect(await second).toBeNull();
  });

  it("closes when the app cancels it", async () => {
    const { picker } = await mountPicker();
    const result = picker.pick();
    await flush();
    picker.cancel();

    expect(await result).toBeNull();
    await closed();
    expect(screen.queryByText("Ana Horvat")).toBeNull();
  });
});

async function closed() {
  for (let i = 0; i < 20 && screen.queryByText("Ana Horvat"); i++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    await nextTick();
  }
}
