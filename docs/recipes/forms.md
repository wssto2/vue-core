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

One `Field` (label, hint, error, required, locked) around each control. `TextField`, `TextareaField`, `NumberField`, `MoneyField`, `SelectField`, `MultiSelectField`, `ComboField`, `SegmentedField`, `ChoiceChips`, `CardSelectField`, `SwitchField`, `CheckboxField`, `DateField`, `DateTimeField`, `TimeField`, `MonthYearField`, `FileField`, `PhotoField`, and `OtpInput`; `Field` itself for a control of your own.

- A field's value type is honest: text is `string` (`""` is empty), a number is `number | null`, a day is `"2026-09-30"` (never a `Date`), a time `"14:35"`, a switch is a boolean, a choice is its option's `value` or `null`. Mapping a nullable column, a 0/1 flag or an instant to these is the record mapping's job.
- **Read mode is the form's or the group's** (`FormView :editable`, `FormGroup :editable`): rows become value rows and empty ones disappear. **Locked is the field's** `disabled`: dimmed on wide screens, a value row on phones; the group's `locked-footer` says why once.
- Dates, times and months are [their own fields](#dates-and-times): typed first, a calendar when you would rather pick. None of them has a `Date` value.
- The upload is the app's: `FileField` and `PhotoField` hold a `File` and check type and size; the form's `send` puts it in a multipart body.

## Dates and times

`DateField`, `DateTimeField`, `TimeField` and `MonthYearField` have no dependency: the calendar is the library's own, and the values are text a form can carry and a server can read, with no time zone to drift through.

| Field | Value | Example |
|---|---|---|
| `DateField` | a day, `string \| null` | `"2026-09-30"` |
| `DateTimeField` | a day and a time on the user's clock, no zone | `"2026-09-30T14:35"` |
| `TimeField` | a time of day | `"14:35"` |
| `MonthYearField` | two numbers, `month` 1 to 12 and `year` | `3`, `2019` |

An empty field is `null`, never `""`. Turning a wall-clock date-time into an instant (and back) is the record mapping's job, as for every field.

<!-- example: docs/examples/forms/components/DeliveryFields.vue:8-16 -->
```ts
const form = useForm({
  defaults: () => ({
    deliveryOn: null as string | null,
    visitAt: null as string | null,
    shiftStart: null as string | null,
    firstMonth: null as number | null,
    firstYear: null as number | null,
  }),
});
```

<!-- example: docs/examples/forms/components/DeliveryFields.vue:28-33 -->
```vue
  <FormGroup>
    <DateField v-bind="form.bind('deliveryOn')" :label="t('forms.deliveryOn')" min="2026-01-01" :quick-picks="['today', 'tomorrow', { label: t('forms.nextDelivery'), day: nextDeliveryDay }]" />
    <DateTimeField v-bind="form.bind('visitAt')" :label="t('forms.visitAt')" min="2026-10-01T08:00" :minute-step="15" />
    <TimeField v-bind="form.bind('shiftStart')" :label="t('forms.shiftStart')" />
    <MonthYearField v-bind="form.bindMonthYear('firstMonth', 'firstYear')" :label="t('forms.firstRegistration')" />
  </FormGroup>
```

### Typing comes first

The text field is the main way in, and it is forgiving. It is read in the order the app writes dates, which the library finds by asking the app's own formatter (`installFormatting` / `createApplication({ formatting })`), so `DD.MM.YYYY.` in one market and `MM/DD/YYYY` in another need nothing here.

| Typed | Means |
|---|---|
| `30.09.2026.`, `30. 9. 2026`, `2026-09-30` | that day (any separator, the trailing dot is optional) |
| `30.9.` | 30 September of this year |
| `15` | the 15th of this month |
| `3009`, `300926`, `30092026` | the parts written without separators |
| `+7`, `-1` | days from today |
| `today`, `tomorrow`, `yesterday` (and the same words of the app's language) | those days |
| `1435`, `14.35`, `14:35`, `14h35`, `935`, `14`, `9.5` | a time (14:35, 09:35, 14:00, 09:05) |
| `now` (and the word of the language) | the time now |

A date-time field reads a date and a time (`15.10.2026. 14:35`, `danas 14.35`); a date alone keeps the value's time (or takes the time now), a time alone keeps its day.

Text that is not what it looks like is never repaired: `29.2.2027.` is not rolled into March, `45.13.` is not a day. It stays in the field next to its message ("Enter a date, for example 01. 10. 2026.", "This date is not available." outside `min` / `max` / `disabledDates`, "Use minutes in steps of 15."), the field's `aria-invalid` is set, and the value is `null` until the text is a real one, so a form never submits the old value under text that says something else. The server's own error for the field still wins over the typed message.

### The calendar

On a wide screen a calendar opens in a popover from a click on the field, from the calendar button, or from the Down arrow. A click leaves the focus in the field, so typing goes on while the calendar follows what is typed; the Down arrow and the button move focus into the calendar. Escape closes it and returns focus to the field.

- The week starts on the locale's first weekday (`Intl`), the month title is live for screen readers, the grid is labelled and the chosen day is `aria-selected`.
- Keys: arrows move by a day or a week, Page Up and Page Down by a month (with Shift a year), Home and End to the week's ends, Enter or Space picks.
- An empty field opens on today's month (or `openOn`), never on `min`'s; days outside `min` and `max`, or in `disabledDates`, cannot be picked or typed.
- The month title (a date field's) opens twelve months under a year header; clicking the year opens twelve years to jump through.

`disabledDates` takes days, `{ from, to }` ranges, or a function. The calendar can also stand on its own:

<!-- example: docs/examples/forms/components/ClosedDaysCalendar.vue:5-7 -->
```ts
const day = ref<string | null>(null);
// Single days and { from, to } ranges (both included); a function `(day) => boolean` says anything else.
const closed = [{ from: "2026-12-24", to: "2026-12-26" }, "2026-12-31"];
```

### Quick picks

A date field offers shortcuts under its calendar: Today, Tomorrow, In 7 days and End of month on a wide screen; Today, Tomorrow and Next working day on a phone. `quickPicks` replaces them: a name of the library's (`today`, `tomorrow`, `week`, `month-end`, `next-working-day`, in the language of the app) or `{ label, day: (today) => day }`, which is how an app puts its own working-day rule in (the library skips Saturdays and Sundays only; it does not know public holidays). A pick the field does not allow is disabled. `DateTimeField` has no day shortcuts unless it is given some, and a time field has `quickTimes` (`"now"`, `"08:00"`, `{ label, time }`).

### Time

Every minute is offered by default: an hour list 00 to 23 and a minute list 00 to 59 beside the typed time. `minute-step` limits both the lists and the typed minutes (a minute off the step is refused with a message, never moved).

### On a phone

Where the app is in its compact presentation (a narrow or touch screen) the field is a button that opens a half sheet: the quick picks, the calendar with large days, and hour and minute wheels that snap (they turn with a finger, with the arrow keys, and without animation for people who ask for reduced motion). The sheet edits a draft: **Done** puts it in the field, **Clear** empties the field, and swiping the sheet away, its backdrop or Escape leave the field as it was. A required field has no Clear.

### Month and year

`MonthYearField` keeps ARV's look: year arrows and twelve month pills. Clicking the year opens a grid of twelve years (with arrows by twelve), so a first registration in 2008 is two clicks away. `minYear` and `maxYear` bound it.

### Reading

Read mode shows the value the way the app formats it (`useFormat().date`, `.dateTime`, `.time`), so an app that writes `DD.MM.YYYY.` keeps it. A locked field is the field's `disabled`, as for every field.

## Testing

`useForm`, `useResourceForm`, `useGroupSheet` and `useCommand` need a component to live in and the library's i18n; the playground-free pattern used by this repo's own tests is a `createApp` with `createI18n`, the formatting plugin and an app-provided leave guard (see `src/form/testing.ts`).
