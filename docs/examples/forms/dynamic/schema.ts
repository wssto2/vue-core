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
  ],
} satisfies FormSchema;

/** The app's media library: the list is its API, the thumbnail a URL with the id in it. */
export const media: ResourceSource = {
  thumbnail: "/media/{id}/thumb",
  image: "/media/{id}",
  list: async ({ search, page, accept }, { signal }) => {
    const response = await fetch(`/api/media?search=${encodeURIComponent(search)}&page=${page}&accept=${encodeURIComponent(accept ?? "")}`, { signal });
    return (await response.json()) as { rows: { id: number; name: string }[]; lastPage: number };
  },
};
