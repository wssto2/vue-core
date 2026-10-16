import { fireEvent, render, screen } from "@testing-library/vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { h } from "vue";
import { testFormatting } from "../testing/format";
import { createTestI18n } from "../testing/i18n";
import ActivityStream, { type ActivityItem } from "./ActivityStream.vue";
import CommentThread, { type CommentItem } from "./CommentThread.vue";
import Composer from "./Composer.vue";

const i18n = createTestI18n();
const global = { plugins: [i18n, testFormatting(i18n)] };

afterEach(() => vi.useRealTimers());

describe("ActivityStream", () => {
  const now = new Date(2026, 8, 15, 12, 0, 0);
  const at = (days: number, hour = 9) => new Date(2026, 8, 15 - days, hour, 30).toISOString();

  it("lists the oldest entry first, under a separator per day", () => {
    vi.useFakeTimers({ now, toFake: ["Date"] });
    const items: ActivityItem[] = [
      { kind: "comment", id: 2, at: at(0), body: "Today's note", author: "Ada" },
      { kind: "event", id: 1, at: at(1), icon: "refreshLine", text: "Moved on", actor: "Ivo" },
      { kind: "comment", id: 3, at: at(5), body: "Long ago" },
    ];
    const { container } = render(ActivityStream, { props: { items }, global });

    const days = [...container.querySelectorAll("[data-test='activity-day']")].map((day) => day.textContent!.trim());
    expect(days).toHaveLength(3);
    expect(days.slice(1)).toEqual(["Yesterday", "Today"]);
    const order = [...container.querySelectorAll("[data-test^='activity-']:not([data-test='activity-day']):not([data-test='activity-stream'])")].map((row) => row.textContent);
    expect(order[0]).toContain("Long ago");
    expect(order[2]).toContain("Today's note");
  });

  it("puts one's own comments on the trailing side and names the author and time on others", () => {
    const items: ActivityItem[] = [
      { kind: "comment", id: 1, at: at(0), body: "Mine", author: "Me", mine: true },
      { kind: "comment", id: 2, at: at(0, 10), body: "Theirs", author: "Ada" },
    ];
    const { container } = render(ActivityStream, { props: { items }, global });
    const [mine, theirs] = [...container.querySelectorAll("[data-test='activity-comment']")];

    expect(mine!.getAttribute("data-mine")).toBe("true");
    expect(theirs!.getAttribute("data-mine")).toBeNull();
    expect(theirs!.textContent).toContain("Ada · ");
  });

  it("draws an event's text, or the #event slot instead", () => {
    const items: ActivityItem[] = [{ kind: "event", id: 1, at: at(0), icon: "refreshLine", text: "Plain text" }];
    const plain = render(ActivityStream, { props: { items }, global });
    expect(plain.container.querySelector("[data-test='activity-event']")!.textContent).toContain("Plain text");
    plain.unmount();

    const slotted = render(ActivityStream, { props: { items }, slots: { event: ({ item }: { item: { id: unknown } }) => h("b", `Custom ${String(item.id)}`) }, global });
    expect(slotted.container.querySelector("[data-test='activity-event']")!.textContent).toContain("Custom 1");
  });
});

describe("Composer", () => {
  it("sends the trimmed text with Ctrl+Enter and not with a plain Enter", async () => {
    const { emitted } = render(Composer, { props: { modelValue: "  hello  " }, global });
    const field = screen.getByRole("textbox");

    await fireEvent.keyDown(field, { key: "Enter" });
    expect(emitted().submit).toBeUndefined();
    await fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });
    expect(emitted().submit).toEqual([["hello"]]);
  });

  it("keeps Send off while the draft is blank, busy or disabled", async () => {
    const view = render(Composer, { props: { modelValue: "  " }, global });
    const send = () => screen.getByRole("button", { name: "Send comment" }) as HTMLButtonElement;
    expect(send().disabled).toBe(true);

    await view.rerender({ modelValue: "x" });
    expect(send().disabled).toBe(false);
    await view.rerender({ processing: true });
    expect(send().disabled).toBe(true);
    await view.rerender({ processing: false, disabled: true });
    expect(send().disabled).toBe(true);
  });
});

describe("CommentThread", () => {
  const comments: CommentItem[] = [
    { id: 1, body: "First note", author: "Ada", createdAt: "2026-09-01T10:00:00Z" },
    { id: 2, body: "Second note", createdAt: "2026-09-02T10:00:00Z", mine: true },
  ];

  it("says so when there are no comments", () => {
    render(CommentThread, { props: { comments: [] }, global });
    expect(screen.getByText("No comments yet.")).toBeTruthy();
  });

  it("shows the composer and the delete buttons only when allowed", () => {
    const closed = render(CommentThread, { props: { comments }, global });
    expect(closed.container.querySelector("[data-test='composer']")).toBeNull();
    expect(closed.container.querySelector("[data-test='comment-remove']")).toBeNull();
    closed.unmount();

    const open = render(CommentThread, { props: { comments, canAdd: true, canRemove: true }, global });
    expect(open.container.querySelector("[data-test='composer']")).not.toBeNull();
    expect(open.container.querySelectorAll("[data-test='comment-remove']")).toHaveLength(2);
  });

  it("hands onAdd the trimmed draft and clears it once the save resolves", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(CommentThread, { props: { comments, canAdd: true, onAdd }, global });
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    await fireEvent.update(field, "  hello  ");
    await fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });
    await vi.waitFor(() => expect(field.value).toBe(""));

    expect(onAdd).toHaveBeenCalledWith("hello");
  });

  it("keeps the draft when onAdd resolves to false", async () => {
    const onAdd = vi.fn().mockResolvedValue(false);
    render(CommentThread, { props: { comments, canAdd: true, onAdd }, global });
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    await fireEvent.update(field, "hello");
    await fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });
    await vi.waitFor(() => expect(onAdd).toHaveBeenCalled());
    await Promise.resolve();

    expect(field.value).toBe("hello");
  });

  it("emits remove with the comment of the bubble", async () => {
    const { emitted } = render(CommentThread, { props: { comments, canRemove: true }, global });
    const first = screen.getAllByRole("button", { name: "Delete comment" })[0]!;
    await fireEvent.click(first);

    expect(emitted().remove).toEqual([[comments[0]]]);
  });

  it("leaves out the heading on request", () => {
    const view = render(CommentThread, { props: { comments, hideTitle: true }, global });
    expect(view.queryByRole("heading", { name: "Comments" })).toBeNull();
  });
});
