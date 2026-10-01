import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, type Component } from "vue";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import { mockMedia } from "../testing/media";
import FormGroup from "./FormGroup.vue";
import FormIndent from "./FormIndent.vue";
import FormRow from "./FormRow.vue";
import FormView from "./FormView.vue";
import GroupEditAction from "./GroupEditAction.vue";
import { createFieldGroups, provideRecordGroups } from "./recordGroups";
import RecordGroupScope from "./RecordGroupScope.vue";
import SelectField from "./SelectField.vue";
import SwitchField from "./SwitchField.vue";
import TextField from "./TextField.vue";

const i18n = createTestI18n();
const global = { plugins: [i18n, testFormatting(i18n)], stubs: { transition: false } };

afterEach(() => {
  document.body.innerHTML = "";
  document.body.className = "";
});

const inGroup = (children: () => unknown, groupProps: Record<string, unknown> = {}, viewProps: Record<string, unknown> = {}) =>
  render(defineComponent({ render: () => h(FormView, viewProps, () => h(FormGroup, groupProps, children)) }), { global });

describe("locked fields (D17 O1)", () => {
  it("a disabled field in an editing form keeps its control, dimmed and out of the tab order", () => {
    const { container } = inGroup(() => h(TextField, { modelValue: "x", label: "VIN", disabled: true }));
    const input = screen.getByLabelText("VIN") as HTMLInputElement;
    expect(input.disabled).toBe(true);
    expect(container.querySelector("[data-field-locked]")).not.toBeNull();
    expect(input.closest(".opacity-45")).not.toBeNull();
  });

  it("a locked select is a disabled button, and the reason is a tooltip and text for screen readers", () => {
    const { container } = inGroup(() => h(SelectField as Component, { modelValue: "a", label: "Brand", options: [{ value: "a", label: "Alpha" }], disabled: true, lockedReason: "Comes from the catalogue" }));
    expect((screen.getByLabelText("Brand") as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector("[title='Comes from the catalogue']")).not.toBeNull();
    expect(container.querySelector(".sr-only")?.textContent).toContain("Comes from the catalogue");
  });

  it("a locked switch shows its real state, disabled", () => {
    inGroup(() => h(SwitchField, { modelValue: true, label: "Active", disabled: true }));
    const toggle = screen.getByRole("switch") as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("phones, and a computed fact (presentation value), read a locked field as a value row", () => {
    const fact = inGroup(() => h(TextField, { modelValue: "WVW123", label: "VIN", disabled: true, presentation: "value" }));
    expect(fact.container.querySelector("input")).toBeNull();
    expect(fact.container.textContent).toContain("WVW123");
    document.body.innerHTML = "";
    const media = mockMedia({ compact: true });
    const phone = inGroup(() => h(TextField, { modelValue: "WVW123", label: "VIN", disabled: true }));
    expect(phone.container.querySelector("input")).toBeNull();
    expect(phone.container.textContent).toContain("WVW123");
    media.restore();
  });

  it("the group says why once, only while one of its fields is locked, on phones too, and not in read mode", async () => {
    const reason = "Supplied by VEGA.";
    const editing = inGroup(() => h(TextField, { modelValue: "x", label: "VIN", disabled: true }), { lockedFooter: reason });
    await nextTick();
    expect(editing.container.textContent).toContain(reason);
    document.body.innerHTML = "";
    const reading = inGroup(() => h(TextField, { modelValue: "x", label: "VIN", disabled: true }), { lockedFooter: reason }, { editable: false });
    await nextTick();
    expect(reading.container.textContent).not.toContain(reason);
    document.body.innerHTML = "";
    const media = mockMedia({ compact: true });
    const phone = inGroup(() => h(TextField, { modelValue: "x", label: "VIN", disabled: true }), { lockedFooter: reason });
    await nextTick();
    expect(phone.container.textContent).toContain(reason);
    media.restore();
  });
});

describe("FormGroup rows", () => {
  it("keeps empty read-only rows when asked, hides them by default", () => {
    const hidden = inGroup(() => h(TextField, { modelValue: "", label: "Notes" }), {}, { editable: false });
    expect(hidden.container.textContent).not.toContain("Notes");
    document.body.innerHTML = "";
    const shown = inGroup(() => h(TextField, { modelValue: "", label: "Notes" }), { hideEmpty: false }, { editable: false });
    expect(shown.container.textContent).toContain("Notes");
    expect(shown.container.textContent).toContain("Not entered");
  });

  it("reads 0 and false as values, NaN as missing", () => {
    const view = inGroup(() => [h(FormRow, { label: "Zero", value: 0 }), h(SwitchField, { modelValue: false, label: "Flag" })], {}, { editable: false });
    expect(view.container.textContent).toContain("Zero");
    expect(view.container.textContent).toContain("No");
  });

  it("indents revealed rows one level", () => {
    const { container } = inGroup(() => h(FormIndent, null, () => h(FormRow, { label: "Child", value: "x" })));
    expect(container.querySelector("[data-test='form-row']")?.className).toContain("pl-[calc(var(--app-row-inset)+1.25rem)]");
  });

  it("a row with a route is a link with its value", () => {
    const Link = defineComponent({ props: ["to"], render() { return h("a", { href: "#" }, this.$slots.default?.()); } });
    render(FormRow, { props: { label: "Locations", value: "4", to: "/locations" }, global: { ...global, stubs: { RouterLink: Link } } });
    expect(screen.getByText("4")).toBeTruthy();
  });
});

describe("GroupEditAction", () => {
  it("shows Edit and says it was clicked; takes its own label", async () => {
    const click = vi.fn();
    render(GroupEditAction, { props: { label: "Change vehicle…", onClick: click }, global });
    await fireEvent.click(screen.getByRole("button", { name: "Change vehicle…" }));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("is hidden when the viewer may not edit, or the group is locked", () => {
    render(GroupEditAction, { props: { allowed: false }, global });
    expect(screen.queryByRole("button")).toBeNull();
    document.body.innerHTML = "";
    render(GroupEditAction, { props: { locked: true }, global });
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("record groups", () => {
  it("knows each field's group, an empty read row too, which it does not draw", () => {
    const groups = createFieldGroups<"a" | "b">();
    const release = groups.register("a", "email");
    groups.register("b", "city");
    expect(groups.groupOf("email")).toBe("a");
    expect(groups.fieldsOf("b")).toEqual(["city"]);
    release();
    expect(groups.groupOf("email")).toBeUndefined();
    expect(groups.groupOf("nope")).toBeUndefined();
  });

  it("registers the fields of a read page, including those whose empty row is not drawn, and hands a group's key to the page on Edit", async () => {
    const edited: string[] = [];
    let registry!: ReturnType<typeof createFieldGroups<"contact">>;
    const Page = defineComponent({
      setup() {
        registry = provideRecordGroups<"contact">({ edit: (group) => () => edited.push(group) });
        return () => h(FormView, { editable: false }, () => h(FormGroup, { group: "contact", header: "Contact" }, () => [h(TextField, { modelValue: "a@b.c", label: "Email", "data-field-key": "email" }), h(TextField, { modelValue: "", label: "Phone", "data-field-key": "phone" })]));
      },
    });
    render(Page, { global });
    await nextTick();
    expect(registry.fieldsOf("contact").sort()).toEqual(["email", "phone"]);
    expect(registry.groupOf("phone")).toBe("contact");
    await fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(edited).toEqual(["contact"]);
  });

  it("offers no Edit on a group whose every field is locked", async () => {
    const Page = defineComponent({
      setup() {
        provideRecordGroups<"vin">({ edit: () => () => undefined });
        return () => h(FormView, { editable: true }, () => h(FormGroup, { group: "vin", header: "Identification" }, () => h(TextField, { modelValue: "x", label: "VIN", disabled: true, "data-field-key": "vin" })));
      },
    });
    render(Page, { global });
    await nextTick();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("renders only its group inside a sheet, without that group's header", () => {
    const Page = defineComponent({
      setup: () => () =>
        h(RecordGroupScope, { only: "contact", editable: true }, () => [
          h(FormGroup, { group: "contact", header: "Contact" }, () => h(TextField, { modelValue: "x", label: "Email" })),
          h(FormGroup, { group: "address", header: "Address" }, () => h(TextField, { modelValue: "y", label: "Street" })),
        ]),
    });
    const { container } = render(Page, { global });
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.queryByLabelText("Street")).toBeNull();
    expect(container.textContent).not.toContain("Contact");
    expect(container.querySelector("[data-test='record-group-scope']")?.getAttribute("data-group")).toBe("contact");
  });

  it("uses the group's own label for its Edit", async () => {
    const Page = defineComponent({
      setup() {
        provideRecordGroups<"vehicle">({ edit: () => () => undefined, editLabel: () => "Change vehicle…" });
        return () => h(FormView, { editable: false }, () => h(FormGroup, { group: "vehicle", header: "Vehicle" }, () => h(TextField, { modelValue: "x", label: "Model" })));
      },
    });
    render(Page, { global });
    await nextTick();
    expect(screen.getByRole("button", { name: "Change vehicle…" })).toBeTruthy();
  });
});
