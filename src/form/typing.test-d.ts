// Type fixtures, checked by `npm run typecheck`: a form's fields, values and payload are typed, not stringly.
import { useForm } from "./useForm";
import { useResourceForm } from "./useResourceForm";
import type { FormValidator } from "./validation";
import type { Resource } from "../resource";
import { useGroupSheet } from "./useGroupSheet";

interface Ticket {
  readonly id: number;
  readonly subject: string;
  readonly due_on: string | null;
}

const form = useForm({ defaults: () => ({ subject: "", priority: null as number | null, tags: [] as string[] }) });

// the values are what `defaults` says
const subject: string = form.values.subject;
const priority: number | null = form.values.priority;
void subject;
void priority;
// @ts-expect-error a field the form does not have
void form.values.nope;

// bind: the name and the value type are checked
const binding = form.bind("priority");
const current: number | null = binding.modelValue;
binding["onUpdate:modelValue"](3);
binding["onUpdate:modelValue"](null);
void current;
// @ts-expect-error a misspelled field
form.bind("priorty");
// @ts-expect-error the field holds a number or null, not text
binding["onUpdate:modelValue"]("high");
// @ts-expect-error the binding's value is not a string
const wrong: string = binding.modelValue;
void wrong;

// the validator's output is the payload, which can differ from the draft
const validator: FormValidator<{ subject: string; priority: number }> = { safeParse: () => ({ success: true, data: { subject: "", priority: 1 } }) };
const validated = useForm({ defaults: () => ({ subject: "", priority: null as number | null }), validator });
void validated.submit(async (payload) => {
  const priorityNumber: number = payload.priority; // no longer null: the schema says so
  // @ts-expect-error the payload is the validator's output, not the draft
  const maybeNull: null = payload.priority;
  void priorityNumber;
  void maybeNull;
  return payload;
});

// a group saving to an endpoint of its own names fields of the form, and receives exactly those
void form.submitFields(["subject", "tags"], async (changes) => {
  const tags: string[] = changes.tags;
  // @ts-expect-error priority is not one of the submitted fields
  void changes.priority;
  void tags;
});
// @ts-expect-error a field the form does not have
void form.submitFields(["subject", "nope"], async () => undefined);

// a record form: the values come from the explicit mapping, the save returns the record
declare const source: Resource<Ticket>;
const record = useResourceForm({
  source,
  defaults: () => ({ subject: "", dueOn: null as string | null }),
  toValues: (ticket) => ({ subject: ticket.subject, dueOn: ticket.due_on }),
  save: async (payload, ticket) => ({ ...ticket, subject: payload.subject }),
});
void record.save();
record.bind("dueOn");
// @ts-expect-error not a value of this form (it is the record's field, not the draft's)
record.bind("due_on");
useResourceForm({
  source,
  defaults: () => ({ subject: "" }),
  // @ts-expect-error the mapping must produce the draft's values
  toValues: (ticket) => ({ subject: ticket.id }),
  save: async (_payload, ticket) => ticket,
});

// a group sheet: its fields are fields of the record's form, and a dedicated endpoint receives exactly them
useGroupSheet({ form: record, group: "general", fields: ["subject"] });
useGroupSheet({
  form: record,
  group: "general",
  fields: ["subject", "dueOn"],
  save: async (changes) => {
    const due: string | null = changes.dueOn;
    void due;
  },
});
useGroupSheet({
  form: record,
  group: "general",
  fields: ["subject"],
  save: async (changes) => {
    // @ts-expect-error dueOn is not one of the sheet's fields, so a dedicated endpoint never receives it
    void changes.dueOn;
  },
});
// @ts-expect-error a field the record's form does not have
useGroupSheet({ form: record, group: "general", fields: ["subject", "nope"] });
// a rebase needs a form that can take a freshly read record as its base
useGroupSheet({ form: record, group: "general", fields: ["subject"], rebase: { reload: async () => undefined, message: () => "stale" } });
