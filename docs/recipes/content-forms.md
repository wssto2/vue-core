# Forms and lists from a schema

`DynamicForm` and `DynamicCollection` are the exception to "no universal CRUD": a **form and a column list generated from a typed schema** (a content type's fields), for an application whose records are defined by data. They draw fields and columns from the schema and nothing else: no page, no save, no routing. The page around them, the request and the permissions stay the application's, written with `EditorPage`, `useForm` and `CollectionPage` as in the [forms](forms.md) and [list page](list-page.md) recipes.

## The schema

A schema is `{ fields }`; a field is `{ key, kind, label, required?, translatable?, props?, options?, validation?, visible_when?, children? }` (snake_case, as the server sends it).

| `kind` | control | value |
|---|---|---|
| `text`, `textarea` | `TextField`, `TextareaField` | `string` |
| `text`, `textarea`, `rich_text` with `translatable` | `I18nField` (the editor for rich text) | `Record<locale, string>` |
| `rich_text` | `RichTextField` | an HTML string |
| `number` | `NumberField` | `number \| null` |
| `boolean` | `SwitchField` | `boolean` |
| `select`, `multi_select` | `SelectField`, `MultiSelectField` over `options: { value, label }[]` | a value, a list of values |
| `date`, `datetime` | `DateField`, `DateTimeField` | the fields' own strings |
| `image`, `document` | `ResourceField` | a resource id |
| `gallery` | `ResourceField multiple` | a list of ids |
| `collection` | `RepeatField` over `children` | a list of rows' values |

<!-- example: docs/examples/forms/dynamic/schema.ts:1-13 -->
```ts
import type { FormSchema, ResourceSource } from "@wssto2/vue-core/form";

/** What the server sends for a content type: the fields, in snake_case. */
export const newsSchema = {
  fields: [
    { key: "title", kind: "text", label: "Title", required: true, translatable: true, validation: [{ rule: "max", args: [150] }] },
    { key: "date", kind: "date", label: "Date", required: true },
    { key: "image", kind: "image", label: "Image" },
    { key: "body", kind: "rich_text", label: "Text", translatable: true, props: { video: true } },
    { key: "category", kind: "select", label: "Category", options: [{ value: "news", label: "News" }, { value: "events", label: "Events" }] },
    { key: "replied", kind: "boolean", label: "Answered" },
    { key: "replied_at", kind: "datetime", label: "Answered at", visible_when: { all: [{ field: "replied", eq: true }] } },
    { key: "slides", kind: "collection", label: "Slides", children: [{ key: "image", kind: "image", label: "Image", required: true }, { key: "caption", kind: "text", label: "Caption" }] },
```

`validation` is a whitelist of `{ rule, args }`: `min` and `max` (a text's length, a number's value, the size of a list), `email`, `url`, `regex`; `required` is the field's flag. `props` holds what a control shows (`placeholder`, `hint`, `rows`, `accept`, `video`, `addLabel`).

## A form

<!-- example: docs/examples/forms/dynamic/ContentEntryEditor.vue -->
```vue
<script setup lang="ts">
import { buildValidator, DynamicForm, useForm } from "@wssto2/vue-core/form";
import { Button } from "@wssto2/vue-core/button";
import { ApiError } from "@wssto2/vue-core/client";
import * as zod from "zod";
import { media, newsSchema } from "./schema";

const props = defineProps<{ save: (values: Record<string, unknown>) => Promise<unknown> }>();

// Zod is passed in: it is an optional peer, and an app that never validates a schema does not load it.
const form = useForm<Record<string, unknown>>({
  defaults: () => ({ replied: false, slides: [] }),
  validator: buildValidator(newsSchema, { zod, defaultLocale: "hr" }),
});

async function submit() {
  // A 422 from go-core lands under the field keys; the fields show it.
  const result = await form.submit((values) => props.save(values));
  if (result.status === "failed" && !(result.failure.error instanceof ApiError)) console.warn(result.failure.message);
}
</script>

<template>
  <DynamicForm
    :schema="newsSchema" :model-value="form.values" :locales="['hr', 'en']" default-locale="hr" locale-mode="form"
    :errors="form.errors.all()" :resources="media" @update:model-value="Object.assign(form.values, $event)" />
  <Button prominence="primary" :processing="form.submitting.value" @click="submit">Save</Button>
</template>
```

- **Value:** `Record<field key, value>`; the form emits a new object on every change and never drops a key.
- **`visible_when`:** `{ all: [...] }` or `{ any: [...] }` of `{ field, eq | ne | in | empty | not_empty }`. A field whose rule does not hold is not shown, **keeps its value**, shows no error, and `buildValidator` neither requires nor checks it nor returns it. `evaluateVisibility(rule, values)` is the same function, for your own code.
- **Errors:** `errors` takes go-core's field messages (`form.errors.all()`, or the `ErrorBag`) by field key; `slides.0.caption` reaches the first row's caption, and `title.hr` marks the Croatian text.
- **Languages:** `localeMode="perField"` (the default) gives each translatable field its `I18nField` strip; `"form"` shows one switcher for the whole form and switches every translatable field and every row of a collection at once (a translated rich text always follows that switcher). `locales` defaults to the application's; `defaultLocale` is the language a required translatable text needs.
- **`readonly`** reads the values as value rows.
- **`buildValidator(schema, { zod, messages?, defaultLocale? })`** checks what the server will: required, the type of each kind, `min` / `max`, `email` / `url` / `regex`, the rows of a collection, `visible_when`. It takes the `zod` module as an argument because Zod is an optional peer and an import inside the library would load it for every app. Its issues carry Zod's messages, which `zodErrorMap(application)` words in the application's language; `messages` replaces `required`, `email`, `url`, `regex`, `type`. The server stays authoritative. A `regex` pattern must be valid for both JavaScript and Go (RE2).

### Resources and rich text

`ResourceField`, and image / document / gallery fields of a `DynamicForm`, take a **`ResourceSource`**: `list(query, { signal })` (the app's media library: `query` is `{ search, page, pageSize, accept? }`, the answer `{ rows: { id, name? }[], lastPage }`) and `thumbnail`, a URL with `{id}` in it. The field shows the pictures of its ids and opens a `PickerModal` over that list to add or change one. Uploads, folders and filters are the application's.

`RichTextField` is [Quill 2](https://quilljs.com) (BSD-3-Clause, about 200 kB minified and 60 kB gzipped, and it reads the HTML that Quill editors stored): an **optional peer dependency** (`npm i quill`), loaded when the field first shows, so an app that never shows one never loads it. The toolbar is the library's own (headings, bold, italic, lists, a link, an image from the media library when `images` is given, a video embed with `video`). The value is the editor's HTML **unsanitised**: the browser does not clean it, the server must before it stores or renders it. Quill's stylesheet is not loaded; the field styles the editing area itself.

## A list

<!-- example: docs/examples/forms/dynamic/ContentEntryList.vue -->
```vue
<script setup lang="ts">
import { DynamicCollection, listLoader } from "@wssto2/vue-core/collection";
import { newsSchema } from "./schema";

// go-core's list convention (page, per_page, order_col, order_dir, search, every filter under its key); the app's API is the loader.
const load = listLoader<Record<string, unknown>>("/admin/api/v1/content/news");
</script>

<template>
  <DynamicCollection id="content.news" :schema="newsSchema" :load="load" title="News" thumbnail="/media/{id}/thumb" :record-route="(row) => `/news/${row.id}`" />
</template>
```

Columns, sorting and filters come from the same schema:

- a column per listable field (text, number, boolean, select, multi select, date, datetime, image, document, gallery); long text, rich text and collections stay out. `columns` names the ones to show, in order;
- the first text field (or `titleField`) is the record's name and links to `recordRoute`; translated text shows in the interface's language (`locale`), else the first one written;
- booleans and selects are badges (yes / no, the option's label), images are pictures from `thumbnail`; a `#cell-<key>` slot replaces any cell;
- sort on text, number, boolean, select, date and datetime fields that are not translated; filters for selects (their options), booleans (`"true"` / `"false"`) and dates (the date presets). The loader receives those keys, so the backend must accept them.

The schema is read once, when the page is set up: key the component by the content type to show another. Underneath it is `defineCollection` with `Row = Record<string, unknown>`, which type-checks for runtime keys.

## Testing

The visibility rule has one shared case list, `test-data/content/visibility.json` in the vue-core repository: `{ description, cases: [{ name, rule, values, visible }] }`, run here by `evaluateVisibility` and in Go by the server's. Copy the file, do not edit the copy; a change to a rule's meaning changes the file in both places.
