<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { DynamicForm, type FormSchema, type ResourceSource } from "@wssto2/vue-core/form";
import { ref } from "vue";

// Every kind of field, a collection, a hint and a language switch: what a content type's form looks like.
const schema: FormSchema = {
  fields: [
    { key: "title", kind: "text", label: "Title", required: true, translatable: true, props: { hint: "Shown on the list and in the page's address." }, validation: [{ rule: "max", args: [80] }] },
    { key: "date", kind: "date", label: "Date", required: true },
    { key: "published_at", kind: "datetime", label: "Published at" },
    { key: "views", kind: "number", label: "Views", props: { placeholder: "0" } },
    { key: "category", kind: "select", label: "Category", options: [{ value: "news", label: "News" }, { value: "events", label: "Events" }] },
    { key: "tags", kind: "multi_select", label: "Tags", options: [{ value: "a", label: "Cars" }, { value: "b", label: "Service" }, { value: "c", label: "Offers" }] },
    { key: "featured", kind: "boolean", label: "Featured on the home page" },
    { key: "summary", kind: "textarea", label: "Summary", translatable: true, props: { rows: 3 } },
    { key: "body", kind: "rich_text", label: "Text", translatable: true },
    { key: "image", kind: "image", label: "Cover image" },
    { key: "file", kind: "document", label: "Brochure" },
    { key: "gallery", kind: "gallery", label: "Gallery" },
    {
      key: "slides", kind: "collection", label: "Slides", props: { addLabel: "Add a slide" },
      children: [
        { key: "caption", kind: "text", label: "Caption", required: true, translatable: true },
        { key: "link", kind: "text", label: "Link", validation: [{ rule: "url" }] },
        { key: "image", kind: "image", label: "Image" },
        { key: "visible", kind: "boolean", label: "Visible" },
      ],
    },
  ],
};

// A data URL stands in for the picture an app's media library serves.
const picture = (id: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" fill="#c7d8d0"/><text x="48" y="54" font-size="16" text-anchor="middle" fill="#2b4a3e">${id}</text></svg>`)}`;
const media: ResourceSource = {
  list: async () => ({ rows: [{ id: 1, name: "one" }, { id: 2, name: "two" }], lastPage: 1 }),
  thumbnail: picture("{id}").replace("%7Bid%7D", "{id}"),
};

const values = ref<Record<string, unknown>>({
  title: { hr: "Novi model u salonu", en: "" },
  date: "2026-10-10",
  views: 1250,
  category: "news",
  tags: ["a", "c"],
  featured: true,
  summary: { hr: "Kratki opis vijesti.", en: "" },
  body: { hr: "<p>Tekst vijesti.</p>", en: "" },
  image: 1,
  gallery: [1, 2],
  slides: [{ caption: { hr: "Prvi slajd", en: "First slide" }, link: "https://example.com", image: 2, visible: true }, { caption: { hr: "", en: "" }, visible: false }],
});
const readonly = ref(false);
const failing = ref(true);
const errors = (): Record<string, string[]> => (failing.value ? { "title.en": ["Required"], date: ["Choose a date."], "slides.1.caption.hr": ["Required"] } : {});
</script>

<template>
  <section class="flex flex-col gap-3">
    <div class="flex items-center gap-2">
      <h2 class="text-headline font-semibold text-content-strong">DynamicForm</h2>
      <Button size="sm" @click="readonly = !readonly">{{ readonly ? "Edit" : "Read" }}</Button>
      <Button size="sm" @click="failing = !failing">{{ failing ? "No errors" : "Errors" }}</Button>
    </div>
    <DynamicForm v-model="values" :schema="schema" :locales="['hr', 'en']" default-locale="hr" locale-mode="form" :errors="errors()" :resources="media" :readonly="readonly" />
  </section>
</template>
