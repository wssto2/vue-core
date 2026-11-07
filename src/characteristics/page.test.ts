import { fireEvent, screen, waitFor, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { callsTo, dataOf, stopApplications } from "../identity/testing";
import type { ItemResponse } from "../modules/characteristics/entities";
import { jsonResponse } from "../testing";
import { CHAR_EDIT, CHAR_VIEW, arvDescription, arvItems, siteBuilderDescription, siteBuilderItems, startCharacteristics } from "./testing";

vi.setConfig({ testTimeout: 30_000 });
afterEach(stopApplications);

const names = () => [...document.querySelectorAll("[data-test=tree-node] > .tree-row button.truncate")].map((button) => button.textContent?.trim());
const body = (call: { init: RequestInit }) => JSON.parse(String(call.init.body));
const refused = (status: number, code: string, params: object = {}) => jsonResponse(status, { success: false, error: code, code, params });
const BRANDS = ["Expand Osnovno", "Expand Marke"];
async function showBrands(props: Parameters<typeof startCharacteristics>[0] = { permissions: [CHAR_VIEW, CHAR_EDIT], description: siteBuilderDescription, items: siteBuilderItems }) {
  const screenState = await startCharacteristics(props);
  await screen.findByRole("heading", { name: "Characteristics" });
  for (const name of BRANDS) await fireEvent.click(await screen.findByRole("button", { name }));
  return screenState;
}
const sheet = async () => within(await screen.findByRole("dialog"));
/** The name field shows one language at a time, the interface's (English here): the default language, Croatian, is its first segment. */
async function writeName(dialog: ReturnType<typeof within>, text: string) {
  await fireEvent.click(dialog.getByText("HR"));
  await fireEvent.update(dialog.getAllByRole("textbox")[0]!, text);
}

describe("CharacteristicsPage: the tree", () => {
  it("draws the tree from the description and the items, closed, with the levels' add buttons", async () => {
    await startCharacteristics({ permissions: [CHAR_VIEW, CHAR_EDIT], description: siteBuilderDescription, items: siteBuilderItems });
    expect(await screen.findByRole("heading", { name: "Characteristics" })).toBeTruthy();
    await waitFor(() => expect(names()).toEqual(["Novosti", "Osnovno", "Webshop"]));
    for (const name of BRANDS) await fireEvent.click(screen.getByRole("button", { name }));
    expect(names()).toEqual(["Novosti", "Osnovno", "Marke", "Renault", "Dacia", "Škoda", "Države", "Webshop"]);
    expect(screen.getAllByRole("button", { name: "Add Group" }).length).toBeGreaterThan(0); // the root add, a page action, labelled with the level's name
    expect(document.querySelector("[data-test=tree-add-footer]")?.textContent).toContain("Add Item");
    expect(screen.getByText(/3 levels/)).toBeTruthy();
  });

  it("shows the branch's own column: the brand code under Marke, blank on the other rows", async () => {
    await showBrands();
    expect(screen.getAllByText("Kod marke")).toHaveLength(1);
    const cells = [...document.querySelectorAll("[data-test=tree-node] > .tree-row [aria-label='Kod marke']")].map((cell) => cell.textContent?.trim());
    expect(cells.filter(Boolean)).toEqual(["renault", "dacia", "skoda"]);
  });

  it("search keeps the ancestors of the matches, and the views Active / Inactive filter by the switch", async () => {
    await showBrands();
    await fireEvent.update(screen.getByPlaceholderText("Search by name"), "dacia");
    await waitFor(() => expect(names()).toEqual(["Osnovno", "Marke", "Dacia"]));
    await fireEvent.update(screen.getByPlaceholderText("Search by name"), "");
    await fireEvent.click(screen.getByRole("tab", { name: "Inactive" }));
    await waitFor(() => expect(names()).toEqual(["Osnovno", "Marke", "Škoda"]));
  });
});

describe("CharacteristicsPage: permissions", () => {
  it("needs characteristics:view: without it the screen and its requests are not there", async () => {
    const { calls } = await startCharacteristics({ permissions: [], description: siteBuilderDescription, items: siteBuilderItems });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByRole("heading", { name: "Characteristics" })).toBeNull();
    expect(callsTo(calls, "GET", "/v1/characteristics")).toHaveLength(0);
  });

  it("with view only: no add, no handles, no switches to flip, a read-only mark, and the row menu only opens", async () => {
    await showBrands({ permissions: [CHAR_VIEW], description: siteBuilderDescription, items: siteBuilderItems });
    expect(screen.getByText("Read only")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Add / })).toBeNull();
    expect(document.querySelector("[data-test=tree-add-footer], [data-test=tree-add-row]")).toBeNull();
    expect(screen.queryAllByRole("button", { name: /^Move / })).toHaveLength(0);
    expect((screen.getByRole("switch", { name: "Active: Dacia" }) as HTMLButtonElement).disabled).toBe(true);
    await fireEvent.click(screen.getByRole("button", { name: "More actions: Dacia" }));
    expect(await screen.findByRole("menuitem", { name: "Open" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
    await fireEvent.click(screen.getByRole("menuitem", { name: "Open" }));
    const dialog = await sheet();
    expect(dialog.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(dialog.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("with edit: the row menu edits, deactivates and deletes", async () => {
    await showBrands();
    await fireEvent.click(screen.getByRole("button", { name: "More actions: Dacia" }));
    for (const name of ["Edit", "Deactivate", "Delete"]) expect(await screen.findByRole("menuitem", { name })).toBeTruthy();
  });
});

describe("CharacteristicsPage: the form comes from the description", () => {
  it("site-builder's: the name in hr and en, the switch, and the brand code locked with the project-code note", async () => {
    await showBrands();
    await fireEvent.click(screen.getByRole("button", { name: "Renault" }));
    const dialog = await sheet();
    expect(dialog.getByText("Osnovno › Marke")).toBeTruthy();
    expect(dialog.getByText("Name")).toBeTruthy();
    expect(dialog.getByText("HR")).toBeTruthy();
    expect(dialog.getByText("EN")).toBeTruthy();
    expect((dialog.getByLabelText("Kod marke") as HTMLInputElement).value).toBe("renault");
    expect((dialog.getByLabelText("Kod marke") as HTMLInputElement).disabled).toBe(true);
    expect(dialog.getByText(/is described in the project's code for the branch Osnovno › Marke/)).toBeTruthy();
    expect(dialog.queryByLabelText("Integracijski ID (portal)")).toBeNull();
  });

  it("a field of another branch is not on the form: Hrvatska (under Države) has no brand code", async () => {
    await showBrands();
    await fireEvent.click(screen.getByRole("button", { name: "Expand Države" }));
    await fireEvent.click(screen.getByRole("button", { name: "Hrvatska" }));
    const dialog = await sheet();
    expect(dialog.queryByLabelText("Kod marke")).toBeNull();
    expect(dialog.queryByText("Extra fields of this branch")).toBeNull();
  });

  it("arv-next's: four levels and an editable 'Integracijski ID (portal)' (and a choice) for its branch, from the same code", async () => {
    await startCharacteristics({ permissions: [CHAR_VIEW, CHAR_EDIT], description: arvDescription, items: arvItems });
    await screen.findByRole("heading", { name: "Characteristics" });
    for (const name of ["Expand Vozila", "Expand Osobna", "Expand Gorivo"]) await fireEvent.click(await screen.findByRole("button", { name }));
    await fireEvent.click(screen.getByRole("button", { name: "Dizel" }));
    const dialog = await sheet();
    const portal = dialog.getByLabelText("Integracijski ID (portal)") as HTMLInputElement;
    expect(portal.value).toBe("D-1");
    expect(portal.disabled).toBe(false);
    expect(dialog.getByText("Gorivo")).toBeTruthy();
    expect(dialog.queryByText(/described in the project's code/)).toBeNull();
    expect(dialog.getByText("Vozila › Osobna › Gorivo")).toBeTruthy();
  });

  it("arv-next's other branch has none of those fields", async () => {
    await startCharacteristics({ permissions: [CHAR_VIEW, CHAR_EDIT], description: arvDescription, items: arvItems });
    await screen.findByRole("heading", { name: "Characteristics" });
    for (const name of ["Expand Vozila", "Expand Osobna", "Expand Pogon"]) await fireEvent.click(await screen.findByRole("button", { name }));
    await fireEvent.click(screen.getByRole("button", { name: "Prednji" }));
    const dialog = await sheet();
    expect(dialog.queryByLabelText("Integracijski ID (portal)")).toBeNull();
  });
});

describe("CharacteristicsPage: saving", () => {
  it("updates with the names per language and the editable values, never the read-only ones, then the switch on its own", async () => {
    const saved: ItemResponse = { ...siteBuilderItems[4]!, name: "Renault Clio" };
    const { calls } = await showBrands({
      permissions: [CHAR_VIEW, CHAR_EDIT], description: siteBuilderDescription, items: siteBuilderItems,
      answers: { "PUT /v1/characteristics/items/3/10": dataOf(saved), "PUT /v1/characteristics/items/3/10/active": dataOf({ ...saved, active: false }) },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Renault" }));
    const dialog = await sheet();
    await fireEvent.update(dialog.getAllByRole("textbox")[0]!, "Renault Clio"); // the English text: the interface's language is the one shown
    await fireEvent.click(dialog.getByRole("switch", { name: "Active" }));
    await fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(callsTo(calls, "PUT", "/v1/characteristics/items/3/10")).toHaveLength(1));
    const sent = body(callsTo(calls, "PUT", "/v1/characteristics/items/3/10")[0]!);
    expect(sent).toMatchObject({ name: "Renault", translations: { hr: "Renault", en: "Renault Clio" } }); // the name is the first language's text
    expect(sent.values).toBeUndefined(); // the brand code is read-only: the project's code fills it in
    await waitFor(() => expect(body(callsTo(calls, "PUT", "/v1/characteristics/items/3/10/active")[0]!)).toEqual({ active: false }));
  });

  it("sends arv-next's editable fields, as typed", async () => {
    const { calls } = await startCharacteristics({
      permissions: [CHAR_VIEW, CHAR_EDIT], description: arvDescription, items: arvItems,
      answers: { "PUT /v1/characteristics/items/4/1": dataOf(arvItems[3]!) },
    });
    await screen.findByRole("heading", { name: "Characteristics" });
    for (const name of ["Expand Vozila", "Expand Osobna", "Expand Gorivo"]) await fireEvent.click(await screen.findByRole("button", { name }));
    await fireEvent.click(screen.getByRole("button", { name: "Dizel" }));
    const dialog = await sheet();
    await fireEvent.update(dialog.getByLabelText("Integracijski ID (portal)"), "D-77");
    await fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(callsTo(calls, "PUT", "/v1/characteristics/items/4/1")).toHaveLength(1));
    expect(body(callsTo(calls, "PUT", "/v1/characteristics/items/4/1")[0]!).values).toEqual({ portal_id: "D-77", fuel: "d" });
  });

  it("refuses an empty name before asking the server", async () => {
    const { calls } = await showBrands();
    await fireEvent.click(screen.getByRole("button", { name: "Renault" }));
    const dialog = await sheet();
    await writeName(dialog, "");
    await fireEvent.click(dialog.getByRole("button", { name: "Save changes" }));
    expect(await dialog.findByText("Required.")).toBeTruthy();
    expect(callsTo(calls, "PUT", "/v1/characteristics/items/3/10")).toHaveLength(0);
  });

  it("creates at each level: the add under Marke makes a level-3 item below it, switched on", async () => {
    const created = { ...siteBuilderItems[4]!, id: 99, name: "Fiat", values: {} };
    const { calls } = await showBrands({ permissions: [CHAR_VIEW, CHAR_EDIT], description: siteBuilderDescription, items: siteBuilderItems, answers: { "POST /v1/characteristics/items/3": dataOf(created) } });
    await fireEvent.click(document.querySelectorAll("[data-test=tree-add-footer]")[0]!);
    const dialog = await sheet();
    expect(dialog.getByText("New: Item")).toBeTruthy();
    await writeName(dialog, "Fiat");
    await fireEvent.click(dialog.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/characteristics/items/3")).toHaveLength(1));
    expect(body(callsTo(calls, "POST", "/v1/characteristics/items/3")[0]!)).toMatchObject({ parent_id: 1, name: "Fiat", active: true }) // the level is the path: ./items/3;
    await waitFor(() => expect(names()).toContain("Fiat"));
  });

  it("the page's add makes a root, without a parent", async () => {
    const { calls } = await startCharacteristics({ permissions: [CHAR_VIEW, CHAR_EDIT], description: siteBuilderDescription, items: siteBuilderItems, answers: { "POST /v1/characteristics/items/1": dataOf({ ...siteBuilderItems[0]!, id: 9, name: "Novo" }) } });
    await fireEvent.click((await screen.findAllByRole("button", { name: "Add Group" }))[0]!);
    const dialog = await sheet();
    expect(dialog.queryByRole("switch", { name: "Active" })).toBeNull(); // level 1 has no active flag
    await writeName(dialog, "Novo");
    await fireEvent.click(dialog.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/v1/characteristics/items/1")).toHaveLength(1));
    expect(body(callsTo(calls, "POST", "/v1/characteristics/items/1")[0]!).parent_id).toBeUndefined();
  });
});

describe("CharacteristicsPage: switching and ordering", () => {
  it("flips the switch at once and confirms with the server", async () => {
    const { calls } = await showBrands({ permissions: [CHAR_VIEW, CHAR_EDIT], description: siteBuilderDescription, items: siteBuilderItems, answers: { "PUT /v1/characteristics/items/3/12/active": dataOf({ ...siteBuilderItems[6]!, active: true }) } });
    await fireEvent.click(screen.getByRole("switch", { name: "Active: Škoda" }));
    await waitFor(() => expect(body(callsTo(calls, "PUT", "/v1/characteristics/items/3/12/active")[0]!)).toEqual({ active: true }));
    expect(screen.getByRole("switch", { name: "Active: Škoda" }).getAttribute("aria-checked")).toBe("true");
  });

  it("puts the switch back when the server refuses", async () => {
    await showBrands({ permissions: [CHAR_VIEW, CHAR_EDIT], description: siteBuilderDescription, items: siteBuilderItems, answers: { "PUT /v1/characteristics/items/3/12/active": refused(500, "boom") } });
    await fireEvent.click(screen.getByRole("switch", { name: "Active: Škoda" }));
    await waitFor(() => expect(screen.getByRole("switch", { name: "Active: Škoda" }).getAttribute("aria-checked")).toBe("false"));
  });

  it("reorders within a parent: Alt+↓ on Renault puts PUT .../position 2, and the list moves at once", async () => {
    const { calls } = await showBrands({ permissions: [CHAR_VIEW, CHAR_EDIT], description: siteBuilderDescription, items: siteBuilderItems, answers: { "PUT /v1/characteristics/items/3/10/position": dataOf(null) } });
    await fireEvent.keyDown(screen.getByRole("button", { name: "Move Renault" }), { key: "ArrowDown", altKey: true });
    await waitFor(() => expect(body(callsTo(calls, "PUT", "/v1/characteristics/items/3/10/position")[0]!)).toEqual({ position: 2 }));
    expect(names()).toEqual(["Novosti", "Osnovno", "Marke", "Dacia", "Renault", "Škoda", "Države", "Webshop"]);
  });
});

describe("CharacteristicsPage: deleting", () => {
  const usage = (extra: object) => dataOf({ known: true, uses: [], children: 0, ...extra });
  async function askDelete(name: string, answers: Record<string, Response>) {
    const state = await showBrands({ permissions: [CHAR_VIEW, CHAR_EDIT], description: siteBuilderDescription, items: siteBuilderItems, answers });
    await fireEvent.click(screen.getByRole("button", { name: `More actions: ${name}` }));
    await fireEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    return { ...state, dialog: within(await screen.findByRole("dialog")) };
  }

  it("says where it is used, offers to deactivate instead, and sends force only after a second confirmation", async () => {
    const { calls, dialog } = await askDelete("Dacia", {
      "GET /v1/characteristics/items/3/11/usage": usage({ uses: [{ what: "pages", count: 2 }, { what: "domain", count: 1 }] }),
      "DELETE /v1/characteristics/items/3/11": dataOf({ deleted: 1, usage_known: true }),
    });
    expect(await dialog.findByText("Used by 2 pages and 1 domain.")).toBeTruthy();
    expect(dialog.getByText(/You can deactivate it instead/)).toBeTruthy();
    expect(dialog.getByRole("button", { name: "Deactivate instead" })).toBeTruthy();
    await fireEvent.click(dialog.getByRole("button", { name: "Delete anyway" }));
    const alert = within(await screen.findByRole("alertdialog"));
    expect(callsTo(calls, "DELETE", "/v1/characteristics/items/3/11")).toHaveLength(0); // one click is not enough
    expect(alert.getByText("Delete for good?")).toBeTruthy();
    await fireEvent.click(alert.getByRole("button", { name: "Delete for good" }));
    await waitFor(() => expect(callsTo(calls, "DELETE", "/v1/characteristics/items/3/11")).toHaveLength(1));
    expect(new URL(callsTo(calls, "DELETE", "/v1/characteristics/items/3/11")[0]!.url, "http://x").searchParams.get("force")).toBe("true");
    await waitFor(() => expect(names()).not.toContain("Dacia"));
  });

  it("an item nothing uses is deleted by one click, without force", async () => {
    const { calls, dialog } = await askDelete("Dacia", {
      "GET /v1/characteristics/items/3/11/usage": usage({}),
      "DELETE /v1/characteristics/items/3/11": dataOf({ deleted: 1, usage_known: true }),
    });
    await waitFor(() => expect(dialog.queryByText("Checking where it is used…")).toBeNull());
    expect(dialog.queryByText(/deactivate it instead/)).toBeNull();
    await fireEvent.click(dialog.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(callsTo(calls, "DELETE", "/v1/characteristics/items/3/11")).toHaveLength(1));
    expect(callsTo(calls, "DELETE", "/v1/characteristics/items/3/11")[0]!.url).not.toContain("force");
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("says when where it is used is not known, and does not claim it is unused", async () => {
    const { dialog } = await askDelete("Dacia", { "GET /v1/characteristics/items/3/11/usage": usage({ known: false }) });
    expect(await dialog.findByText("Where it is used is not known, so it may be used somewhere.")).toBeTruthy();
    expect(dialog.getByRole("button", { name: "Delete anyway" })).toBeTruthy();
  });

  it("says when it has items below it, with the plural", async () => {
    const { dialog } = await askDelete("Marke", { "GET /v1/characteristics/items/2/1/usage": usage({ children: 3 }) });
    expect(await dialog.findByText("It has 3 items below it.")).toBeTruthy();
    expect(dialog.getByRole("button", { name: "Delete anyway" })).toBeTruthy();
  });

  it("deactivate instead switches it off and closes", async () => {
    const { calls, dialog } = await askDelete("Dacia", {
      "GET /v1/characteristics/items/3/11/usage": usage({ uses: [{ what: "pages", count: 1 }] }),
      "PUT /v1/characteristics/items/3/11/active": dataOf({ ...siteBuilderItems[5]!, active: false }),
    });
    await fireEvent.click(await dialog.findByRole("button", { name: "Deactivate instead" }));
    await waitFor(() => expect(body(callsTo(calls, "PUT", "/v1/characteristics/items/3/11/active")[0]!)).toEqual({ active: false }));
    expect(callsTo(calls, "DELETE", "/v1/characteristics/items/3/11")).toHaveLength(0);
  });

  it("a delete refused after all (used meanwhile) keeps the dialog and reads the usage again", async () => {
    const { calls, dialog } = await askDelete("Dacia", {
      "GET /v1/characteristics/items/3/11/usage": usage({}),
      "DELETE /v1/characteristics/items/3/11": refused(409, "characteristics.in_use", { uses: "1 page" }),
    });
    await waitFor(() => expect(dialog.queryByText("Checking where it is used…")).toBeNull());
    await fireEvent.click(dialog.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(callsTo(calls, "GET", "/v1/characteristics/items/3/11/usage").length).toBeGreaterThan(1));
    expect(names()).toContain("Dacia");
  });
});
