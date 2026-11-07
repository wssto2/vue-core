# Characteristics: lookup lists as one tree

go-core's `characteristics` module keeps the reference data editors pick from (news categories, brands, delivery countries) in the project's own tables, described in code, as one tree. vue-core has the whole screen over its routes, and the select that picks from it. Types and routes come from go-core (`src/modules/characteristics`, `npm run modules:sync`); nothing on the screen is specific to a project: the levels, the languages and the extra fields come from `GET /v1/characteristics/description`, so two projects with different tables get different forms from the same code.

## The screen

<!-- example: docs/examples/lists/characteristics.ts -->
```ts
import { createApplication } from "@wssto2/vue-core/app";
import { characteristicsFeature } from "@wssto2/vue-core/characteristics";
import { identityFeature, identityPlatform } from "@wssto2/vue-core/identity";
import { createPlatform, parseBootstrap } from "@wssto2/vue-core/platform";
import { backofficeShell } from "@wssto2/vue-core/shell";

declare module "@wssto2/vue-core/router" {
  interface DestinationRegistry {
    characteristics: true;
  }
}

// The whole screen: the tree from GET /v1/characteristics, the form from GET /description. The menu node the server sends for it is bound to the feature.
const platform = createPlatform({ config: parseBootstrap({ locale: "hr", app_name: "Admin", api_base: "/api" }), ...identityPlatform() });

export const application = createApplication({
  platform,
  shell: backofficeShell(),
  features: [identityFeature(), characteristicsFeature({ destination: "characteristics" })],
});
```

`characteristicsFeature({ destination? })` installs `/characteristics` (route `characteristics.index`, `characteristicsPages.index` for links). It is a **feature, not a page to mount**, like the access and service-account screens: it needs its route, its access rule and its title together. `CharacteristicsPage` is exported for an application that wants its own route.

- **Permissions.** The route needs `characteristics:view`; every write action (add, edit, switch, reorder, delete) needs `characteristics:edit`. Without it the same screen is read-only (a "Read only" mark, no handles, the row menu only opens). go-core grants neither to anybody: give `characteristics.Grants()` to the webmaster role.
- **The tree** is `GET /v1/characteristics` as a `CollectionTree`: search, the views *All / Active only / Inactive*, the switch, reorder (`PUT .../position`, applied at once and put back if the server refuses), an add button per level. Its text is a whole phrase, never a noun pasted after "Dodaj:": the library says "Dodaj skupinu" at the top level and "Dodaj stavku" below, and the application passes its own per level through `characteristicsFeature({ addLabel: (parent, level) => … })` (e.g. "Dodaj marku" under Marke; `undefined` keeps the neutral phrase).
- **An item opens in a `Sheet`**, built from the description: the name per language as the description lists them (a single field for a level without translations), the active switch, and the level's extra fields for the branch the item is in, each by its type (text, number, yes/no, choice). A read-only field is shown locked with a note that the project's code fills it; a field of another branch is not on the form. A field marked `in_list` is a column of the tree, on its branch only.
- **Delete asks where the item is used** (`GET .../usage`): "Koriste je 2 stranice i 1 domena", "where it is used is not known" (never read as "unused"), "has 3 items below it". Each of those means a delete would take something with it, so the dialog offers **Deactivate instead**, and deleting needs a **second confirmation** that sends `force`. An item nothing uses is deleted by one click, without `force`.

## The select: `CharacteristicField`

A form picks from the tree with `CharacteristicField` (`@wssto2/vue-core/form`), over `GET /v1/characteristics/options`:

<!-- example: docs/examples/lists/BrandField.vue -->
```vue
<script setup lang="ts">
import { CharacteristicField, SwitchField, useForm } from "@wssto2/vue-core/form";

// A form picks from the tree: the models of the chosen brand, saved as the item's id; the countries, saved as the project's own code.
const form = useForm({ defaults: () => ({ brand: null as number | null, model: null as number | null, countries: [] as string[], publish: true }) });
const brandsListId = 1; // the id of the item "Marke" (level 2): its children, on level 3, are the brands

defineProps<{ savedBrand?: { value: number; label: string } }>();
</script>

<template>
  <!-- `selected` names an inactive item that is already chosen: the server offers only active ones. -->
  <CharacteristicField v-bind="form.bind('brand')" label="Brand" :level="3" :parent="brandsListId" lang="hr" :selected="savedBrand" required />
  <CharacteristicField v-bind="form.bind('countries')" label="Countries" :level="3" :parent="2" value="code" multiple />
  <SwitchField v-bind="form.bind('publish')" label="Publish" />
</template>
```

| | |
|---|---|
| `level`, `parent` | the active items below `parent` on `level`, in the tree's order. Below level 1, nothing is asked until `parent` is known; when it changes, a chosen value the new branch lacks is cleared. |
| `value` | what is saved: `"id"` (default, a number) or the name of a described column (`"code"`: that text). |
| `lang` | the language of the labels; default the first the project lists. |
| `multiple` | the model is a list (`Value[]`); the model's type follows it, so `form.bind()` fits either way. |
| `searchable` | the search box (default on). |
| `selected` | an inactive item that is already chosen: the server offers only active ones and cannot say what an inactive item is called, so the record's saved option is given here and shows as "Škoda (neaktivno)". Once unticked (multiple) or replaced, it is gone from the list. |

It is a `SelectField` (or `MultiSelectField`) that fetches its own options, so it takes the same field props (`label`, `hint`, `required`, `disabled`, `error` ...) and `form.bind()`, and its loading state (a spinner, "Loading…") and failure ("Try again") are theirs. A `DynamicForm` field of kind `select` can use it through the field's slot the same way.

## Known limits

- The item sheet has no discard-changes guard (`Sheet` has no `beforeDismiss`): closing it drops unsaved edits.
- In the tree the drag handle sits left of the chevron; the mock-up has the chevron first.

## What the module does not give (reported to go-core)

- The description has no "add" text per level, only the level's name, and a phrase cannot be built from a name in Croatian. If apps keep passing `addLabel`, go-core could carry a per-level `add` label (hr/en) in `LevelResponse`; nothing is changed there.

- The usage answer is counts per kind (`{ what, count }`), not the list of pages and domains; the mock-up's list of places cannot be drawn from it.
- `options` lists only active items, and an inactive chosen item has no endpoint an editor may read (`show` needs `characteristics:view`): the caller keeps the label (`selected`).
