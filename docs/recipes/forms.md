# Forms

`@wssto2/vue-core/form` has three compositions, one per user task. Pick by the task, not by the widget.

| The user… | Compose | Who saves |
|---|---|---|
| changes **one group of a record** | `FormGroup` + `GroupSheet` + `useGroupSheet` | the sheet, one save, the page has none |
| **creates** a record, or edits a justified long form | `EditorPage` + `useForm` (or `useResourceForm`) | the page, one coordinated submit in the page chrome |
| **advances, reassigns, approves, re-prices** | `useCommand` + `CommandDialog` (or `AlertDialog`) | one purpose-specific call with its own confirmation |

A screen with group sheets has no global Save. A command is never a field autosave.

The code below is `docs/examples/forms/` (a ticket feature: a record in group sheets, a create form, an assign command), compiled by `npm run typecheck:docs`. A larger working example, with a fake backend that answers 422 and 409, is `playground/src/app/features/forms/`.

## Once per application

Nothing to set up. `createApplication` installs the application's leave guard, so `useLeaveGuard` (and every form, sheet and command that asks "Discard changes?") works in any page, and `backofficeShell` renders the one dialog that asks. A shell of your own renders `<LeaveGuardRoot />` once; without it a page with unsaved changes that is left fails with a `MissingLeaveGuardRootError` instead of letting the user lose their work silently (the [shell recipe](shell.md) has the custom shell).

<!-- example: docs/examples/shell/CustomShell.vue:37-38 -->
```vue
    <!-- The one "Discard changes?" dialog: forms with unsaved changes ask through it. `backofficeShell` renders it; a shell of your own must. -->
    <LeaveGuardRoot />
```

The app's validator is whatever has Zod's `safeParse` shape (Zod 3 and 4, or a hand-written object). The library does not depend on Zod.

## Form state

<!-- example: docs/examples/forms/form.ts:44-51 -->
```ts
  return useForm({
    defaults: () => ({ subject: "", priority: null as number | null, tags: [] as string[] }), // the draft: what fields edit
    validator: {
      safeParse: (input) => ((input as { subject: string }).subject.trim() === "" ? { success: false, error: { issues: [{ path: ["subject"], message: "Enter a subject." }] } } : { success: true, data: input as { subject: string; priority: number | null; tags: string[] } }),
    },
    translate: (message) => t(message), // server codes into sentences
    serverField: camel, // `due_on` is `dueOn` in the draft
  });
```

<!-- example: docs/examples/forms/components/CreateFields.vue:12-13 -->
```vue
    <TextField v-bind="props.form.bind('subject')" :label="t('forms.subject')" required />
    <NumberField v-bind="props.form.bind('priority')" :label="t('forms.priority')" />
```

`bind()` is typed from the draft: `bind('subjct')` or a number field bound to text does not compile. It supplies the value, the change, the error and a marker the page uses to count errors. Changing a field clears its message.

`form.submit(send)` validates a copy of the draft (the schema never rewrites what was typed), calls `send(payload, { idempotencyKey })`, and ends as one of:

| `result.status` | meaning | what the form does |
|---|---|---|
| `saved` | went through | the draft is the new baseline |
| `saved-refresh-failed` | went through, reading it back failed (`refresh` option) | baseline moves (saving again would repeat the mutation); `form.failure.kind === "refresh"` |
| `failed` | nothing saved | the draft is kept; `form.failure.kind` says `invalid`, `conflict`, `forbidden`, `unauthorized`, `offline` or `failed` |
| `aborted` | cancelled | nothing |

A second `submit` while one runs returns the same promise. Server validation lands on the fields (dotted paths for nested values: `lines.0.quantity`); an error whose field is not on screen is listed by `FormErrors`, never dropped.

A value inside a list is wired by hand: `v-model="line.quantity"`, `:error="form.errors.first(`lines.${i}.quantity`)"` and `v-bind="fieldKey(`lines.${i}.quantity`)"` (the marker).

### Over a loaded record

<!-- example: docs/examples/forms/views/Record.vue:15-23 -->
```ts
const ticket = useRouteResource({ key: TICKET, param: "ticketID", load: (id, { signal }) => api.get(id, signal) });
const form = useResourceForm({
  source: ticket, // hydrates from the page's record: no second request
  defaults: emptyTicket,
  validator: ticketSchema,
  toValues: ticketValues, // DTO to draft, explicit
  serverField: camel,
  save: (payload, current, { idempotencyKey }) => api.update(current.id, ticketBody(payload, current), idempotencyKey), // the record's full update
});
```

It is filled once and again for another record; a record that changes under unsaved edits (a background reload) does not replace them (`form.outdated`; `reset()` takes the new one); a save puts the returned record in the resource once.

## 1. One group of a record (D22)

<!-- example: docs/examples/forms/views/Record.vue:25-26 -->
```ts
const sheets = {} as Record<"details" | "contact", { present: () => void }>;
const groups = provideRecordGroups<"details" | "contact">({ edit: (group) => sheets[group].present });
```

Each group is one sheet. Details saves the record's full update (the default) and rebases a stale save; Contact has an endpoint of its own:

<!-- example: docs/examples/forms/views/Record.vue:28-35 -->
```ts
// Details saves the record's full update (the default); its endpoint documents 409 as "your copy is stale", so a stale save is rebased.
const details = useGroupSheet({
  form,
  group: "details",
  fields: ["subject", "priority", "dueOn"],
  groupOf: groups.groupOf,
  rebase: { reload: () => ticket.reload(), message: () => t("forms.stale") },
});
```

<!-- example: docs/examples/forms/views/Record.vue:36-44 -->
```ts
// Contact has an endpoint of its own: it receives exactly these fields. A 409 there is shown as the conflict it is.
const contact = useGroupSheet({
  form,
  group: "contact",
  fields: ["email", "phone"],
  groupOf: groups.groupOf,
  save: (changes) => api.saveContact(ticket.id.value ?? 0, changes),
  onSaved: () => ticket.reload(),
});
```
<!-- example: docs/examples/forms/views/Record.vue:50-65 -->
```vue
<template>
  <ResourcePage :resource="ticket" :title="ticket.data.value?.subject ?? t('forms.ticket')" :back="{ label: t('forms.tickets'), to: '/' }">
    <template #header="{ record }"><RecordHeader :title="record.subject" /></template>
    <template #default>
      <FormView :editable="false"><TicketSections :form="form" /></FormView>
      <AssignDialog />
    </template>
  </ResourcePage>

  <GroupSheet :sheet="details" :title="t('forms.details')" :editable="true" :group-label="groupLabel">
    <RecordGroupScope only="details" :editable="true"><TicketSections :form="form" /></RecordGroupScope>
  </GroupSheet>
  <GroupSheet :sheet="contact" :title="t('forms.contact')" :editable="true" :group-label="groupLabel">
    <RecordGroupScope only="contact" :editable="true"><TicketSections :form="form" /></RecordGroupScope>
  </GroupSheet>
</template>
```

One markup serves the read page and every sheet: in its sheet only the group shows. Decisions the sheet makes explicit:

- **Transport.** By default it saves the record's **full update** (`form.save()`: the whole valid record with this group's changes). A group with an endpoint of its own says so: `save: (changes) => api.saveContact(id, changes)` receives exactly the group's fields, and the other fields are neither sent nor judged. The two are never inferred from each other.
- **Conflict.** A 409 is shown as the conflict it is, and nothing is retried. Only an endpoint that documents 409 as "your copy is stale" is rebased: `rebase: { reload: () => ticket.reload(), message: () => t("stale") }` re-reads the record, lays the user's *changed* fields back on top (an untouched field takes the new value), tells them, and waits for a deliberate second Save.
- **Foreign errors.** A failed save that complains about another group's field names that group at the top of the sheet; the error stays in the form, so that group's sheet shows it when opened. A field no group claims is listed (`fallbackGroup` names it).
- **Cancel** puts back only the group's fields (`restore` widens this for fields that derive from each other across groups), clears its errors, and a sheet with edits asks first. Focus returns to Edit.
- **Refresh.** `onSaved` re-reads what else depends on the record. If it fails the save still counts, the sheet closes and a toast says the record could not be read back.

## 2. A long form

<!-- example: docs/examples/forms/views/Create.vue:22-24 -->
```vue
  <EditorPage :title="t('forms.create')" :back="{ label: t('forms.tickets'), to: '/' }" :form="form" :save-label="t('forms.create')" @save="save">
    <SectionPanel :title="t('forms.details')" number="01" presentation="section"><CreateFields :form="form" /></SectionPanel>
  </EditorPage>
```
<!-- example: docs/examples/forms/views/Create.vue:15-18 -->
```ts
async function save() {
  const result = await form.submit((payload, { idempotencyKey }) => api.create({ subject: payload.subject, priority: payload.priority, due_on: null, email: "", phone: "" }, idempotencyKey));
  if (result.status === "saved") void router.push({ name: "forms.record", params: { ticketID: result.value.id } });
}
```

With a `form` the page does the rest: Save in the page chrome with a spinner, "Unsaved changes" and Cancel, the leave guard, the failure banner, an error count and a check per section, a required-fields progress bar, and after a refused submit focus on the first error with its (collapsed) section opened. Derived values (totals) are plain `computed`s over `form.values` in the feature. A page of your own uses `useSaveChrome({ form, save, cancel })`.

## 3. A command

<!-- example: docs/examples/forms/components/AssignDialog.vue:13-23 -->
```ts
const assign = useCommand({
  defaults: () => ({ assignee: null as number | null, note: "" }),
  validator: {
    safeParse: (input) => {
      const { assignee, note } = input as { assignee: number | null; note: string };
      return assignee === null ? { success: false, error: { issues: [{ path: ["assignee"], message: "Choose who takes it." }] } } : { success: true, data: { assignee, note } };
    },
  },
  run: (input, { idempotencyKey }) => api.assign(ticket.id.value ?? 0, { assignee_id: input.assignee, note: input.note }, idempotencyKey),
  done: (saved) => ticket.update(saved),
});
```
<!-- example: docs/examples/forms/components/AssignDialog.vue:27-33 -->
```vue
  <Button @click="assign.present()">{{ t("forms.assign") }}</Button>
  <CommandDialog :command="assign" :title="t('forms.assign')" :confirm-label="t('forms.assign')">
    <FormGroup>
      <ComboField v-bind="assign.form.bind('assignee')" :label="t('forms.assignee')" :search="(query, { signal }) => api.users(query, signal)" />
      <TextareaField v-bind="assign.form.bind('note')" :label="t('forms.note')" stacked />
    </FormGroup>
  </CommandDialog>
```

Field errors land on the fields, a conflict or no permission is said in the banner, the inputs stay on a failure, closing with typed input asks first, and `present({ assignee: 3 })` starts from what is already known. A command with nothing to enter is `<AlertDialog :action="command.confirm" …>`: it stays open and emits `failed` when the call does not go through.

## Fields

One `Field` (label, hint, error, required, locked) around each control. `TextField`, `TextareaField`, `NumberField`, `MoneyField`, `SelectField`, `MultiSelectField`, `ComboField`, `SegmentedField`, `ChoiceChips`, `CardSelectField`, `SwitchField`, `CheckboxField`, `DateField`, `DateTimeField`, `MonthYearField`, `FileField`, `PhotoField`, and `OtpInput`; `Field` itself for a control of your own.

- A field's value type is honest: text is `string` (`""` is empty), a number is `number | null`, a day is `"2026-09-30"` (never a `Date`), a switch is a boolean, a choice is its option's `value` or `null`. Mapping a nullable column, a 0/1 flag or an instant to these is the record mapping's job.
- **Read mode is the form's or the group's** (`FormView :editable`, `FormGroup :editable`): rows become value rows and empty ones disappear. **Locked is the field's** `disabled`: dimmed on wide screens, a value row on phones; the group's `locked-footer` says why once.
- Dates use the browser's own controls (no calendar dependency); the typed `Date` of a calendar widget is not offered.
- The upload is the app's: `FileField` and `PhotoField` hold a `File` and check type and size; the form's `send` puts it in a multipart body.

## Testing

`useForm`, `useResourceForm`, `useGroupSheet` and `useCommand` need a component to live in and the library's i18n; the playground-free pattern used by this repo's own tests is a `createApp` with `createI18n`, the formatting plugin and an app-provided leave guard (see `src/form/testing.ts`).
