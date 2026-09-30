import { computed, shallowRef, type ComputedRef } from "vue";
import type { FieldMessages } from "./validation";

/**
 * The messages of a form per field. Replaced as a whole on every change (never mutated in place,
 * so a message list the server sent is not altered by a later `add`), and reactive.
 *
 * Fields are addressed by name; a value inside a list or object by its dotted path (`items.0.quantity`).
 */
export class ErrorBag {
  private readonly messages = shallowRef<FieldMessages>({});

  /** How many fields have a message. */
  readonly count: ComputedRef<number> = computed(() => Object.keys(this.messages.value).length);

  /** Replaces everything. Empty lists are dropped. */
  set(messages: FieldMessages): void {
    this.messages.value = Object.fromEntries(Object.entries(messages).filter(([, list]) => list.length > 0).map(([key, list]) => [key, [...list]]));
  }

  add(field: string, message: string): void {
    this.messages.value = { ...this.messages.value, [field]: [...(this.messages.value[field] ?? []), message] };
  }

  /** Clears one field (and its nested paths), or everything. */
  clear(field?: string): void {
    if (field === undefined) {
      if (this.count.value > 0) this.messages.value = {};
      return;
    }
    const rest = Object.fromEntries(Object.entries(this.messages.value).filter(([key]) => key !== field && !key.startsWith(`${field}.`)));
    if (Object.keys(rest).length !== this.count.value) this.messages.value = rest;
  }

  /** Whether the field, or a value inside it (`items.0.quantity` for `items`), has a message. */
  has(field: string): boolean {
    return this.first(field) !== undefined || Object.keys(this.messages.value).some((key) => key.startsWith(`${field}.`));
  }

  first(field: string): string | undefined {
    return this.messages.value[field]?.[0];
  }

  all(): FieldMessages {
    return this.messages.value;
  }
}
