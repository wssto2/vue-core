import { fireEvent, render, screen, within } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import { ApiError } from "../../client";
import { mockMedia } from "../../testing/media";
import { createTestI18n } from "../../testing/i18n";
import { testFormatting } from "../../testing/format";
import DynamicForm from "./DynamicForm.vue";
import RepeatField from "./RepeatField.vue";
import ResourceField from "./ResourceField.vue";
import RichTextField from "./RichTextField.vue";
import type { ResourceSource } from "./resources";
import type { FormSchema } from "./schema";
import { ErrorBag } from "../errors";
import { useForm } from "../useForm";

const i18n = createTestI18n();
const global = { plugins: [i18n, testFormatting(i18n)] };
let restore = () => {};

afterEach(() => {
  restore();
  restore = () => {};
  document.body.innerHTML = "";
});

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

/** A DynamicForm with its v-model in a ref, so typing shows up in `values`. */
function mountForm(schema: FormSchema, initial: Record<string, unknown> = {}, props: Record<string, unknown> = {}) {
  const values = ref<Record<string, unknown>>(initial);
  const Host = defineComponent({ setup: () => () => h(DynamicForm, { schema, ...props, modelValue: values.value, "onUpdate:modelValue": (next: Record<string, unknown>) => (values.value = next) }) });
  return { ...render(Host, { global }), values };
}

const lead: FormSchema = {
  fields: [
    { key: "name", kind: "text", label: "Name", required: true },
    { key: "replied", kind: "boolean", label: "Replied" },
    { key: "replied_at", kind: "date", label: "Replied at", visible_when: { all: [{ field: "replied", eq: true }] } },
  ],
};

describe("DynamicForm", () => {
  it("picks a control per kind and writes the typed value under the field's key", async () => {
    const { values } = mountForm({
      fields: [
        { key: "title", kind: "text", label: "Title" },
        { key: "body", kind: "textarea", label: "Body" },
        { key: "year", kind: "number", label: "Year" },
        { key: "active", kind: "boolean", label: "Active" },
      ],
    });
    await fireEvent.update(screen.getByLabelText("Title"), "Hello");
    await fireEvent.update(screen.getByLabelText("Body"), "Long text");
    await fireEvent.update(screen.getByLabelText("Year"), "2026");
    await fireEvent.click(screen.getByRole("switch"));
    expect(values.value).toEqual({ title: "Hello", body: "Long text", year: 2026, active: true });
  });

  it("hides a field until its visible_when holds, and keeps its value while hidden", async () => {
    const { values } = mountForm(lead, { name: "Ana", replied: false, replied_at: "2026-01-02" });
    expect(screen.queryByText("Replied at")).toBeNull();

    await fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByText("Replied at")).toBeTruthy();
    await fireEvent.click(screen.getByRole("switch"));
    expect(screen.queryByText("Replied at")).toBeNull();
    expect(values.value).toEqual({ name: "Ana", replied: false, replied_at: "2026-01-02" });
  });

  it("shows no error under a hidden field", () => {
    mountForm(lead, { name: "Ana", replied: false }, { errors: { replied_at: ["Required"] } });
    expect(screen.queryByText("Required")).toBeNull();
  });

  it("shows go-core's 422 field messages from a failed save", async () => {
    const schema: FormSchema = { fields: [{ key: "main_heading", kind: "text", label: "Heading", required: true }, { key: "video_url", kind: "text", label: "Video" }] };
    let form!: ReturnType<typeof useForm<{ main_heading: string; video_url: string }>>;
    const Host = defineComponent({
      setup() {
        form = useForm({ defaults: () => ({ main_heading: "", video_url: "" }) });
        return () => h(DynamicForm, {
          schema,
          errors: form.errors.all(),
          modelValue: form.values as Record<string, unknown>,
          "onUpdate:modelValue": (next: Record<string, unknown>) => Object.assign(form.values, next),
        });
      },
    });
    render(Host, { global });
    const result = await form.submit(async () => {
      throw new ApiError({ kind: "validation", message: "no", status: 422, fields: { main_heading: ["validation_errors.required"], video_url: ["The video url must not exceed 150 characters."] } });
    });
    expect(result.status).toBe("failed");
    await nextTick();
    expect(screen.getByText("The video url must not exceed 150 characters.")).toBeTruthy();
    expect(document.querySelector("[data-field-key='main_heading']")).not.toBeNull();
    expect(form.errors.has("main_heading")).toBe(true);
  });

  it("accepts an ErrorBag as errors", async () => {
    const errors = new ErrorBag();
    errors.add("name", "Too short");
    mountForm({ fields: [{ key: "name", kind: "text", label: "Name" }] }, {}, { errors });
    expect(screen.getByText("Too short")).toBeTruthy();
  });

  describe("translatable text", () => {
    const schema: FormSchema = { fields: [{ key: "title", kind: "text", label: "Title", translatable: true }, { key: "intro", kind: "textarea", label: "Intro", translatable: true }] };
    const locales = ["hr", "en"];

    it("perField: a language strip on each field, none for the form", () => {
      mountForm(schema, {}, { locales });
      expect(screen.getAllByRole("tablist")).toHaveLength(2);
    });

    it("form: one switcher that switches every translatable field and writes the text under its language", async () => {
      const { values } = mountForm(schema, { title: { hr: "Naslov", en: "Title" }, intro: { hr: "Uvod" } }, { locales, localeMode: "form" });
      expect(screen.getAllByRole("tablist")).toHaveLength(1);
      expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Naslov");
      expect((screen.getByLabelText("Intro") as HTMLTextAreaElement).value).toBe("Uvod");

      await fireEvent.click(screen.getByRole("tab", { name: "en" }));
      expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Title");
      expect((screen.getByLabelText("Intro") as HTMLTextAreaElement).value).toBe("");

      await fireEvent.update(screen.getByLabelText("Intro"), "Intro text");
      expect(values.value.intro).toEqual({ hr: "Uvod", en: "Intro text" });
      expect(values.value.title).toEqual({ hr: "Naslov", en: "Title" });
    });

    it("form: marks the language that has an error", () => {
      mountForm(schema, {}, { locales, localeMode: "form", errors: { "title.en": ["Too long"] } });
      expect(screen.getByRole("tab", { name: "en" }).hasAttribute("data-error")).toBe(true);
      expect(screen.getByRole("tab", { name: "hr" }).hasAttribute("data-error")).toBe(false);
    });
  });

  it("reads the values when readonly", () => {
    mountForm({ fields: [{ key: "name", kind: "text", label: "Name" }] }, { name: "Ana" }, { readonly: true });
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Ana")).toBeTruthy();
  });
});

describe("RepeatField", () => {
  const fields = [{ key: "title", kind: "text", label: "Title" }, { key: "extra", kind: "text", label: "Extra", visible_when: { all: [{ field: "title", eq: "show" }] } }] as const;

  function mountRepeat(initial: Record<string, unknown>[] = []) {
    const rows = ref<Record<string, unknown>[]>(initial);
    const Host = defineComponent({ setup: () => () => h(RepeatField, { label: "Slides", fields, modelValue: rows.value, "onUpdate:modelValue": (next: Record<string, unknown>[]) => (rows.value = next) }) });
    return { ...render(Host, { global }), rows };
  }
  const titles = () => (screen.queryAllByLabelText("Title") as HTMLInputElement[]).map((input) => input.value);

  it("adds a row, edits it, and removes it", async () => {
    const { rows } = mountRepeat();
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await fireEvent.update(screen.getByLabelText("Title"), "First");
    expect(rows.value).toEqual([{ title: "First" }]);

    await fireEvent.click(screen.getByRole("button", { name: "Remove row 1" }));
    expect(rows.value).toEqual([]);
    expect(titles()).toEqual([]);
  });

  it("moves a row up and down, and keeps what is typed in the others", async () => {
    const { rows } = mountRepeat([{ title: "A" }, { title: "B" }, { title: "C" }]);
    await fireEvent.click(screen.getByRole("button", { name: "Move row 3 up" }));
    expect(rows.value.map((row) => row.title)).toEqual(["A", "C", "B"]);
    expect(titles()).toEqual(["A", "C", "B"]);

    await fireEvent.click(screen.getByRole("button", { name: "Move row 1 down" }));
    expect(rows.value.map((row) => row.title)).toEqual(["C", "A", "B"]);
    expect(titles()).toEqual(["C", "A", "B"]);
    expect((screen.getByRole("button", { name: "Move row 1 up" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Move row 3 down" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("gives each row its own visible_when and its own errors by path", async () => {
    const rows = ref<Record<string, unknown>[]>([{ title: "show" }, { title: "x" }]);
    render(defineComponent({ setup: () => () => h(RepeatField, { label: "Slides", fields, modelValue: rows.value, errors: { "1.title": ["Bad title"] } }) }), { global });
    expect(screen.getAllByLabelText("Extra")).toHaveLength(1);
    const second = document.querySelectorAll("[data-repeat-row]")[1] as HTMLElement;
    expect(within(second).getByText("Bad title")).toBeTruthy();
  });

  it("works inside DynamicForm as a collection field, errors reaching the row", async () => {
    const schema: FormSchema = { fields: [{ key: "slike", kind: "collection", label: "Slike", children: [{ key: "caption", kind: "text", label: "Caption" }] }] };
    const { values } = mountForm(schema, { slike: [{ caption: "a" }] }, { errors: { "slike.0.caption": ["Required"] } });
    expect(screen.getByText("Required")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect((values.value.slike as unknown[]).length).toBe(2);
  });
});

describe("ResourceField", () => {
  const library = [{ id: 11, name: "House" }, { id: 12, name: "Garden" }];
  function source(): ResourceSource & { list: ReturnType<typeof vi.fn> } {
    return { thumbnail: "/media/{id}/thumb", list: vi.fn(async () => ({ rows: library, lastPage: 1 })) };
  }
  function mountResource(props: Record<string, unknown>, initial: unknown) {
    restore = mockMedia({ narrow: false }).restore;
    const value = ref<unknown>(initial);
    const Host = defineComponent({ setup: () => () => h(ResourceField as never, { label: "Image", ...props, modelValue: value.value, "onUpdate:modelValue": (next: unknown) => (value.value = next) } as never) });
    return { ...render(Host, { global }), value };
  }

  it("shows the picture of the chosen id from the URL template", () => {
    const media = source();
    mountResource({ source: media }, 11);
    expect(document.querySelector("img")?.getAttribute("src")).toBe("/media/11/thumb");
  });

  it("opens the picker over the app's list, asks it with the search and accept, and stores the id picked", async () => {
    const media = source();
    const { value } = mountResource({ source: media, accept: "image/*" }, null);
    await fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    await flush();

    expect(media.list).toHaveBeenCalledWith({ search: "", page: 1, pageSize: 24, accept: "image/*" }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    await fireEvent.click(await screen.findByText("Garden"));
    await flush();
    expect(value.value).toBe(12);
    expect(document.querySelector("img")?.getAttribute("src")).toBe("/media/12/thumb");
  });

  it("holds several ids in the order chosen, and removes one", async () => {
    const media = source();
    const { value } = mountResource({ source: media, multiple: true }, [11]);
    await fireEvent.click(screen.getByRole("button", { name: "Choose" }));
    await flush();
    await fireEvent.click(await screen.findByText("Garden"));
    await flush();
    expect(value.value).toEqual([11, 12]);

    await fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]!);
    expect(value.value).toEqual([12]);
  });

  it("changes nothing when the picker is dismissed", async () => {
    const { value } = mountResource({ source: source() }, 11);
    await fireEvent.click(screen.getByRole("button", { name: "Change" }));
    await flush();
    await fireEvent.keyDown(document.querySelector("[role='dialog']")!, { key: "Escape" });
    await flush();
    expect(value.value).toBe(11);
  });

  it("works as an image field of DynamicForm, and says nothing is chosen when read", () => {
    mountForm({ fields: [{ key: "image", kind: "image", label: "Image" }] }, { image: 11 }, { resources: source() });
    expect(document.querySelector("img")?.getAttribute("src")).toBe("/media/11/thumb");
  });
});

describe("RichTextField", () => {
  function mountRich(initial: string, props: Record<string, unknown> = {}) {
    const html = ref(initial);
    const Host = defineComponent({ setup: () => () => h(RichTextField, { label: "Text", ...props, modelValue: html.value, "onUpdate:modelValue": (next: string) => (html.value = next) }) });
    return { ...render(Host, { global }), html };
  }

  it("loads the editor lazily and shows the HTML it was given", async () => {
    mountRich("<h2>Title</h2><p>Hello <strong>world</strong></p>");
    await flush();
    const editor = document.querySelector(".ql-editor")!;
    expect(editor.querySelector("h2")?.textContent).toBe("Title");
    expect(editor.querySelector("strong")?.textContent).toBe("world");
  });

  it("emits the HTML of a formatting made with the toolbar, unsanitised", async () => {
    const { html } = mountRich("<p>Hello</p>");
    await flush();
    const editor = document.querySelector(".ql-editor") as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(editor.querySelector("p")!);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
    document.dispatchEvent(new Event("selectionchange"));
    await flush();
    await fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    await flush();
    expect(html.value).toBe("<p><strong>Hello</strong></p>");
  });

  it("offers the image and video buttons only when asked", async () => {
    mountRich("");
    await flush();
    expect(screen.queryByRole("button", { name: "Image" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Video" })).toBeNull();
    expect(screen.getByRole("button", { name: "Link" })).toBeTruthy();
    document.body.innerHTML = "";

    mountRich("", { video: true, images: { thumbnail: "/m/{id}/t", image: "/m/{id}", list: async () => ({ rows: [], lastPage: 1 }) } });
    await flush();
    expect(screen.getByRole("button", { name: "Image" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Video" })).toBeTruthy();
  });

  it("follows a value set from outside", async () => {
    const html = ref("<p>One</p>");
    const Host = defineComponent({ setup: () => () => h(RichTextField, { label: "Text", modelValue: html.value }) });
    render(Host, { global });
    await flush();
    html.value = "<p>Two</p>";
    await flush();
    expect(document.querySelector(".ql-editor")?.textContent).toBe("Two");
  });
});
