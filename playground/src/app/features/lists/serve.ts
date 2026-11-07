// A fake go-core characteristics backend for the playground: the description of site-builder's tables (three levels, a read-only brand code)
// or, with `?project=arv`, arv-next's (four levels, an editable portal id); the tree in memory, every route of the module.
type Label = { hr: string; en: string };
type Item = { level: number; id: number; parent_id: number; name: string; translations: Record<string, string>; order: number; active: boolean; meta: object; values: Record<string, unknown> };

const label = (hr: string, en = hr): Label => ({ hr, en });
const field = (column: string, name: string, extra: object = {}) => ({ column, label: label(name), type: "text", choices: [], max: 0, in_list: false, read_only: false, under: null, ...extra });
const level = (n: number, name: [string, string], fields: object[] = [], extra: object = {}) => ({ level: n, label: label(...name), name_max: 100, has_translations: true, has_order: true, has_active: true, has_meta: false, fields, ...extra });

const SITE_BUILDER = {
  languages: ["hr", "en"],
  levels: [
    level(1, ["Skupina", "Group"], [], { has_active: false }),
    level(2, ["Popis", "List"]),
    level(3, ["Stavka", "Item"], [field("additional_3", "Kod marke", { in_list: true, read_only: true, max: 64, under: { level: 2, id: 1 } })]),
  ],
};
const ARV = {
  languages: ["hr", "en"],
  levels: [
    level(1, ["Skupina", "Group"], [], { has_active: false }),
    level(2, ["Kategorija", "Category"]),
    level(3, ["Podkategorija", "Subcategory"]),
    level(4, ["Stavka", "Item"], [field("portal_id", "Integracijski ID (portal)", { in_list: true, max: 20, under: { level: 3, id: 1 } })]),
  ],
};

let nextId = 1000;
const item = (level: number, id: number, parent_id: number, name: string, order: number, extra: Partial<Item> = {}): Item => ({ level, id, parent_id, name, translations: { hr: name, en: name }, order, active: true, meta: {}, values: {}, ...extra });
const BRANDS = [["Renault", true], ["Dacia", true], ["Peugeot", true], ["Citroën", true], ["Opel", true], ["Volkswagen", true], ["Škoda", false]] as const;
const SB_ITEMS: Item[] = [
  item(1, 1, 0, "Novosti", 1), item(2, 3, 1, "Akcije", 1),
  item(1, 2, 0, "Osnovno", 2), item(2, 1, 2, "Marke", 1),
  ...BRANDS.map(([name, active], index) => item(3, 10 + index, 1, name, index + 1, { active, values: { additional_3: name.toLowerCase().replace("š", "s").replace("ë", "e") } })),
  item(2, 2, 2, "Države", 2), item(3, 30, 2, "Hrvatska", 1), item(3, 31, 2, "Slovenija", 2),
  item(1, 3, 0, "Webshop", 3),
];
const ARV_ITEMS: Item[] = [item(1, 1, 0, "Vozila", 1), item(2, 1, 1, "Osobna", 1), item(3, 1, 1, "Gorivo", 1), item(4, 1, 1, "Dizel", 1, { values: { portal_id: "D-1" } }), item(4, 2, 1, "Benzin", 2, { values: { portal_id: "B-2" } })];

const state = { project: "", items: [] as Item[] };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "X-Request-ID": "playground" } });
const ok = (data: unknown) => json(200, { success: true, data });
const refuse = (status: number, code: string) => json(status, { success: false, error: code, code });

function load() {
  const project = new URLSearchParams(location.search).get("project") === "arv" ? "arv" : "sb";
  if (state.project !== project) Object.assign(state, { project, items: structuredClone(project === "arv" ? ARV_ITEMS : SB_ITEMS) });
  return project === "arv" ? ARV : SITE_BUILDER;
}
const children = (of: Item) => state.items.filter((each) => each.level === of.level + 1 && each.parent_id === of.id);
const ordered = () => [...state.items].sort((a, b) => a.level - b.level || a.order - b.order); // the module sends depth first: the playground's screen sorts anyway

/** Answers `/api/v1/characteristics...`, or nothing for another URL. */
export async function serveCharacteristics(url: string, init: RequestInit): Promise<Response | null> {
  const { pathname, searchParams } = new URL(url, location.origin);
  const at = pathname.indexOf("/v1/characteristics");
  if (at < 0) return null;
  const description = load();
  const route = pathname.slice(at + "/v1/characteristics".length);
  const method = (init.method ?? "GET").toUpperCase();
  const body = typeof init.body === "string" && init.body !== "" ? JSON.parse(init.body) : {};
  await new Promise((resolve) => setTimeout(resolve, 120));
  if (route === "" && method === "GET") return ok({ items: ordered() });
  if (route === "/description") return ok(description);
  if (route === "/options") {
    const asked = Number(searchParams.get("level"));
    return ok(state.items.filter((each) => each.level === asked && each.active && (asked === 1 || each.parent_id === Number(searchParams.get("parent")))).sort((a, b) => a.order - b.order).map((each) => ({ value: String(each.id), label: each.name })));
  }
  const match = /^\/items\/(\d+)(?:\/(\d+))?(?:\/(active|position|usage))?$/.exec(route);
  if (!match) return refuse(404, "not_found");
  const [, rawLevel, rawId, action] = match;
  const levelNo = Number(rawLevel);
  const found = state.items.find((each) => each.level === levelNo && each.id === Number(rawId));
  if (rawId === undefined && method === "POST") {
    const made = item(levelNo, nextId++, body.parent_id ?? 0, body.name, state.items.filter((each) => each.level === levelNo && each.parent_id === (body.parent_id ?? 0)).length + 1, { translations: body.translations ?? {}, active: body.active ?? true, values: body.values ?? {} });
    state.items.push(made);
    return ok(made);
  }
  if (!found) return refuse(404, "not_found");
  if (action === "usage") return ok({ known: true, uses: found.name === "Renault" ? [{ what: "stranice", count: 2 }, { what: "domena", count: 1 }] : [], children: children(found).length });
  if (action === "active") return ok(Object.assign(found, { active: body.active }));
  if (action === "position") {
    const siblings = state.items.filter((each) => each.level === levelNo && each.parent_id === found.parent_id).sort((a, b) => a.order - b.order);
    siblings.splice(siblings.indexOf(found), 1);
    siblings.splice(body.position - 1, 0, found);
    siblings.forEach((each, index) => (each.order = index + 1));
    return ok(null);
  }
  if (method === "PUT") return ok(Object.assign(found, { name: body.name, translations: body.translations ?? found.translations, values: { ...found.values, ...(body.values ?? {}) } }));
  if (method === "DELETE") {
    if (children(found).length > 0 && searchParams.get("force") !== "true") return refuse(409, "characteristics.has_children");
    const drop = (each: Item) => {
      children(each).forEach(drop);
      state.items = state.items.filter((other) => other !== each);
    };
    drop(found);
    return ok({ deleted: 1, usage_known: true });
  }
  return refuse(404, "not_found");
}
