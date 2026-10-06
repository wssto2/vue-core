import { render } from "@testing-library/vue";
import { describe, expect, it } from "vitest";
import { computed, defineComponent, h } from "vue";
import { createTestI18n } from "../testing/i18n";
import { useDatePresetFilter } from "./datePresets";
import { defineCollection } from "./definition";
import { fakeLoader, flush, page } from "./testing";
import { useCollection, type Collection } from "./useCollection";

const PRESETS = ["today", "yesterday", "this_week", "last_week", "this_month", "last_month", "this_year", "last_year"];

function mountList(locale: string, label?: () => string) {
  const i18n = createTestI18n({ locale });
  const loader = fakeLoader(() => page([]));
  const definition = defineCollection({ id: "dated", stateVersion: 1, load: loader.load, key: (row: { id: number }) => row.id, query: { filters: ["created_at"] } });
  let list!: Collection<{ id: number }, string, "created_at", string>;
  let runs = 0;
  render(
    defineComponent({
      setup() {
        const created = useDatePresetFilter("created_at", label);
        list = useCollection(definition, { state: { kind: "memory" }, filters: computed(() => (runs++, [created.value])) }) as never;
        return () => h("div");
      },
    }),
    { global: { plugins: [i18n] } },
  );
  return { i18n, filter: () => list.filters.value[0]!, runs: () => runs };
}

describe("useDatePresetFilter", () => {
  it("offers go-core's date presets with translated labels", () => {
    const { filter } = mountList("hr");
    expect(filter().key).toBe("created_at");
    expect(filter().type).toBe("select");
    expect(filter().options?.map((option) => option.value)).toEqual(PRESETS);
    expect(filter().options?.[0]?.label).toBe("Danas");
    expect(filter().label).toBe("Uneseno");
  });

  it("follows the locale while the list is open, and the caller's own label with it", async () => {
    const { i18n, filter, runs } = mountList("hr");
    expect(filter().options?.[0]?.label).toBe("Danas");
    const before = runs();
    i18n.global.locale.value = "en";
    await flush();
    expect(filter().options?.[0]?.label).not.toBe("Danas");
    expect(filter().label).not.toBe("Uneseno");
    expect(runs()).toBeGreaterThan(before);

    let name = "Datum";
    const own = mountList("hr", () => name);
    expect(own.filter().label).toBe("Datum");
    name = "Date"; // a getter over plain state is not reactive; the locale re-run reads it again
    own.i18n.global.locale.value = "en";
    await flush();
    expect(own.filter().label).toBe("Date");
  });
});
