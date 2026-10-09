# Forms

`@wssto2/vue-core/form` has four compositions, one per user task. Pick by the task, not by the widget.

| The user… | Compose | Who saves |
|---|---|---|
| changes **one group of a record** | `FormGroup` + `GroupSheet` + `useGroupSheet` | the sheet, one save, the page has none |
| **creates** a record, or edits a justified long form | `EditorPage` + `useForm` (or `useResourceForm`) | the page, one coordinated submit in the page chrome |
| **creates or edits one record** in a dialog (an admin list) | `useCommand` + `CommandDialog`, with `#actions` for "save and add another" | the dialog, one call; create and edit are the same command |
| **advances, reassigns, approves, re-prices** | `useCommand` + `CommandDialog` (or `AlertDialog`) | one purpose-specific call with its own confirmation |
| **creates something over several short screens** | `useStepForm` + `StepForm` (in a `Modal` or on a page) | the last step's button, one submit of the whole form |

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
    describeFieldError: (message) => t(message), // server codes into sentences
    serverField: camel, // `due_on` is `dueOn` in the draft
  });
```

<!-- example: docs/examples/forms/components/CreateFields.vue:12-13 -->
```vue
    <TextField v-bind="props.form.bind('subject')" :label="t('forms.subject')" required />
    <NumberField v-bind="props.form.bind('priority')" :label="t('forms.priority')" />
```

`describeFieldError` turns a server's field message (often a code or a translation key) into a sentence. Say it once for the application with `createApplication({ describeFieldError })` ([app setup](app-setup.md#error-sentences)); a form that words it differently passes its own, which wins. Without either, messages show as sent.

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

With a `form` the page does the rest: Save in the page chrome with a spinner, "Unsaved changes" and Cancel, the leave guard, the failure banner, an error count and a check per section, a required-fields progress bar, and after a refused submit focus on the first error with its (collapsed) section opened. Derived values (totals) are plain `computed`s over `form.values` in the feature. A page of your own uses `useSaveChrome({ form, save, cancel })`; see [a section edited in place](#a-section-edited-in-place).

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

### One record in a dialog (create and edit)

An admin list where each row is a small record is a command whose dialog is used twice: **new** (empty, with "Save and add another") and **edit** (filled with the row). It is a recipe, not a component: about thirty lines on `useCommand` and `CommandDialog`, which already bring the discard guard ("Discard changes?" when closing with typed input, however it is dismissed), the "Saving…" then "Saved" beat before the dialog closes, field errors on the fields with focus on the first, and the failure banner. What the feature adds is which endpoint (`editing`), the success toast and the extra action.

<!-- example: docs/examples/forms/components/CategoryDialog.vue:13-29 -->
```ts
const editing = ref<Category | null>(null); // null: a new one

// One command for both: create or edit. The dialog brings the discard guard, the "saved" beat, the field errors and the focus.
const save = useCommand({
  defaults: () => ({ name: "", active: true }),
  validator: { safeParse: (input) => ((input as { name: string }).name.trim() === "" ? { success: false, error: { issues: [{ path: ["name"], message: "Enter a name." }] } } : { success: true, data: input as { name: string; active: boolean } }) },
  run: (input, { idempotencyKey }) => (editing.value ? api.updateCategory(editing.value.id, input, idempotencyKey) : api.createCategory(input, idempotencyKey)),
  done: () => {
    toast.success(t("forms.categorySaved"));
    emit("saved");
  },
});

defineExpose({
  create: () => ((editing.value = null), save.present()),
  edit: (category: Category) => ((editing.value = category), save.present({ name: category.name, active: category.active })),
});
```

<!-- example: docs/examples/forms/components/CategoryDialog.vue:33-41 -->
```vue
  <CommandDialog :command="save" :title="editing ? t('forms.editCategory') : t('forms.newCategory')" :confirm-label="t('forms.save')">
    <FormGroup>
      <TextField v-bind="save.form.bind('name')" :label="t('forms.name')" required />
      <SwitchField v-bind="save.form.bind('active')" :label="t('forms.active')" />
    </FormGroup>
    <template v-if="!editing" #actions="{ run, busy }">
      <Button :disabled="busy" @click="run({ addAnother: true })">{{ t("forms.saveAndAddAnother") }}</Button>
    </template>
  </CommandDialog>
```

- `create()` and `edit(row)` are what the page calls (`dialog.value?.create()`); `present(initial)` starts from the defaults with what is known laid over them, so an edit never shows what the last dialog left. A record that must be read first (`api.get(id)`) is read by the page, which then calls `edit(record)`.
- `done` runs after the call went through: the toast and telling the page to reload.
- The `#actions` slot gets `run` and `busy`. `run({ addAnother: true })` saves exactly like the primary action, calls `done` (so the toast shows), then opens the dialog again with the defaults and focus on the first field, instead of closing. Render the button only for a new record (`v-if="!editing"`); it takes no part in the discard guard because the fresh form is not dirty. A refused save (a field error) behaves as with the primary action: nothing is cleared.
- Read-only users do not get the button that calls `create()`/`edit()` (`access.can`), not a disabled dialog.

Used from a list, which is the page's own:

<!-- example: docs/examples/forms/views/Categories.vue:13-19 -->
```vue

<template>
  <Button prominence="primary" @click="dialog?.create()">{{ t("forms.newCategory") }}</Button>
  <ul>
    <li v-for="category in categories" :key="category.id"><Button prominence="link" @click="dialog?.edit(category)">{{ category.name }}</Button></li>
  </ul>
  <CategoryDialog ref="dialog" @saved="emit('changed')" />
```

## 4. Step-by-step forms

A form in steps is still **one `useForm`**: the steps only decide which fields are on screen and when each is checked. Use it when the user does one thing in a few short screens (a lead in three steps, an appraisal that asks a question at a time), not for a long form that wants sections (that is `EditorPage`) and not for work done over days in any order (that is a record whose sections are workflow steps, see the [record page recipe](record-page.md)).

`useStepForm(form, { steps, submit })` holds the flow. Each step names the **fields it owns**, so Next checks only those (with the form's own validator), the step counts their errors, and an error the validator or the server sends for a field of an earlier step takes the user back to it. A step without fields (an overview) is never refused. Field names are checked against the form, and `StepForm` takes one slot per step, named after it: a typo in either does not compile.

### In a dialog, with a bar

<!-- example: docs/examples/forms/components/NewTicketSteps.vue:24-36 -->
```ts
// Each step names the fields it owns: Next checks those and nothing else, the step counts their errors, and an error
// the server sends for one of them takes the user back to the step.
const flow = useStepForm(form, {
  steps: [
    { name: "details", label: t("forms.details"), fields: ["subject", "priority"] },
    { name: "contact", label: t("forms.contact"), fields: ["email", "phone"] },
    { name: "review", label: t("forms.review") },
  ],
  submit: (payload, { idempotencyKey }) => api.create({ subject: payload.subject, priority: payload.priority, due_on: null, email: payload.email, phone: payload.phone }, idempotencyKey),
  submitLabel: t("forms.create"),
  onSaved: () => void modal.value?.dismiss(),
  draft: { key: "tickets:new" }, // survives a reload; removed on submit and on discard
});
```

<!-- example: docs/examples/forms/components/NewTicketSteps.vue:41-64 -->
```vue
<template>
  <!-- The dialog takes its subtitle ("Step 2 of 3 · Contact"), its primary button ("Next: Review"), the wait and the
       "Discard changes?" question from the flow; the bar goes in its header and Back, named after its target, in its footer. -->
  <Modal ref="modal" :title="t('forms.newTicket')" grouped size="md" v-bind="flow.bindDialog()" @primary="flow.next()" @dismissed="flow.restart()">
    <template #header><StepProgress :flow="flow" /></template>
    <template #timestamp><Button v-if="flow.backLabel.value" prominence="plain" icon="arrowLeftSLine" @click="flow.back()">{{ flow.backLabel.value }}</Button></template>

    <StepForm :flow="flow" progress="none" navigation="host">
      <template #details>
        <FormGroup>
          <TextField v-bind="form.bind('subject')" :label="t('forms.subject')" required />
          <NumberField v-bind="form.bind('priority')" :label="t('forms.priority')" />
        </FormGroup>
      </template>
      <template #contact>
        <FormGroup>
          <TextField v-bind="form.bind('email')" type="email" :label="t('forms.email')" />
          <TextField v-bind="form.bind('phone')" type="tel" :label="t('forms.phone')" />
        </FormGroup>
      </template>
      <template #review><p>{{ form.values.subject }}</p></template>
    </StepForm>
  </Modal>
</template>
```

What the flow does for you:

- **Progress.** `StepProgress` (or `StepForm progress="bar"`, the default) draws one segment per step with its number and name; a step that is done gets a ✓, a step with errors shows how many fields are wrong, and a step already passed is a button that goes back to it. `progress="dots"` draws one dot per step with the current one wide: for steps that depend on answers, whose names cannot be told in advance.
- **Words.** `flow.subtitle` is "Step 2 of 3 · Contact" (and "· draft saved"); the buttons name their target: Back is the previous step's label, Next is "Next: Review", a step may set its own `nextLabel` ("Confirm"), and the last step's button is the `submitLabel`.
- **Checks.** Next checks the current step only. A step may add `beforeNext`, an async check or lookup that resolves false to keep the user there (the button waits, `flow.busy`). Back checks nothing and loses nothing: values and the other steps' errors stay. Going forward by clicking a step re-checks every step on the way.
- **Sending.** The last step's Next sends the whole form with `submit`; the validator's or the server's refusal puts the user on the first step with an error, a failure that is not about a field (a conflict, no permission) is said in the banner and the user stays, and the draft is kept in every case. On success `onSaved` runs and the draft is gone.
- **Leaving.** Closing the dialog (Escape, the close button, the scrim) with something entered asks "Discard changes?" through the app's leave guard: `bindDialog()` hands the dialog the question as its `before-dismiss`. On a page the leave guard asks on navigation by itself.
- **Draft.** With `draft: { key }` what was entered, the step and the steps passed are kept in `sessionStorage` (or `storage: "local"`) a moment after each change, and put back after a reload; the step form says "Continuing your saved draft" and offers "Start over". It is removed on submit and on discard. Change `version` when the form's shape changes: a draft of another version is ignored, and only keys the form has, holding the same kind of value, are restored. Values must be JSON (a file is never kept). A browser that blocks storage simply has no draft.
- **Motion.** A step slides in from the side the user came from; under reduced motion it fades. Focus follows the step (to the step itself, never into a field, which would raise a phone's keyboard) and goes to the first field in error after a refused Next. Enter inside a field is Next.

### On a page, with dots, and steps that change

<!-- example: docs/examples/forms/views/Triage.vue:11-25 -->
```ts
const form = useForm({ defaults: () => ({ subject: "", urgent: null as number | null, reason: "" }) });
const asksReason = computed(() => (form.values.urgent ?? 0) > 2);

// The steps depend on an answer: a high urgency adds a question. The user stays on their step by name, and the
// dots count what is asked now (a bar of names could not say in advance).
const flow = useStepForm(form, {
  steps: () => [
    { name: "subject" as const, label: t("forms.subject"), fields: ["subject" as const] },
    { name: "urgent" as const, label: t("forms.priority"), fields: ["urgent" as const] },
    ...(asksReason.value ? [{ name: "reason" as const, label: t("forms.reason"), fields: ["reason" as const] }] : []),
    { name: "review" as const, label: t("forms.review") },
  ],
  submit: async () => undefined,
  onSaved: () => void router.push("/"),
});
```

<!-- example: docs/examples/forms/views/Triage.vue:28-38 -->
```vue
<template>
  <!-- On a page the flow draws its own Back, Cancel and Next under the step. -->
  <AdaptivePageShell :title="t('forms.triage')" :description="flow.subtitle.value" width="content">
    <StepForm :flow="flow" progress="dots" @cancel="router.push('/')">
      <template #subject><h3 class="text-center text-title font-bold">{{ t("forms.subjectQuestion") }}</h3><TextField v-bind="form.bind('subject')" :label="t('forms.subject')" /></template>
      <template #urgent><h3 class="text-center text-title font-bold">{{ t("forms.priorityQuestion") }}</h3><NumberField v-bind="form.bind('urgent')" :label="t('forms.priority')" /></template>
      <template #reason><h3 class="text-center text-title font-bold">{{ t("forms.reasonQuestion") }}</h3><TextField v-bind="form.bind('reason')" :label="t('forms.reason')" /></template>
      <template #review><p class="text-center">{{ form.values.subject }}</p></template>
    </StepForm>
  </AdaptivePageShell>
</template>
```

`steps` may be a getter or a ref: steps can be added or removed while the flow runs. The user stays on their step **by name**; if it goes away they land on the one that took its place, and the steps after the current one are no longer counted as done (the answers they stood on may have changed). A step's slot content is your own: a large title for one question per screen, a `FormGroup` for a few fields.

`StepForm` has `navigation="inline"` (default: Back, Cancel and Next under the step, `@cancel` for the page to answer) or `"host"` when a `Modal` or a footer of your own owns the buttons: a `Modal` takes `flow.bindDialog()`, a `Sheet` or a page footer renders `<StepNavigation :flow="flow" @cancel="…" />`. A `Sheet` has no `before-dismiss`, so use a `Modal` for a flow that must ask before it is closed.

## Fields

One `Field` (label, hint, error, required, locked) around each control. `TextField`, `TextareaField`, `NumberField`, `MoneyField`, `SelectField`, `MultiSelectField`, `ComboField`, `SegmentedField`, `ChoiceChips`, `CardSelectField`, `SwitchField`, `CheckboxField`, `DateField`, `DateTimeField`, `TimeField`, `MonthYearField`, `FileField`, `PhotoField` (tap the picture to look at it in the photo viewer), `I18nField`, `PhoneField` (its own subpath, below), and `OtpInput`; `Field` itself for a control of your own.

- A field's value type is honest: text is `string` (`""` is empty), a number is `number | null`, a day is `"2026-09-30"` (never a `Date`), a time `"14:35"`, a switch is a boolean, a choice is its option's `value` or `null`. Mapping a nullable column, a 0/1 flag or an instant to these is the record mapping's job.
- **Read mode is the form's or the group's** (`FormView :editable`, `FormGroup :editable`): rows become value rows and empty ones disappear. **Locked is the field's** `disabled`: dimmed on wide screens, a value row on phones; the group's `locked-footer` says why once.
- **A select that cannot be cleared never hands back `null`.** Without `clearable`, `SelectField` emits its option's value, so a draft field typed `1 | 2 | 3` binds to it; with `clearable` it emits `Value | null`. Either takes `null` as the value it is given (a select that starts empty shows its placeholder). One exception the type cannot see: options that load drop a value the new options lack, so a field bound to a select whose options change should be able to hold `null`.
- **`label-hidden`** (any field): the label is still the control's accessible name (and the read row's) but is not drawn. For a field whose group header already says it.
- Dates, times and months are [their own fields](#dates-and-times): typed first, a calendar when you would rather pick. None of them has a `Date` value.
- The upload is the app's: `FileField` and `PhotoField` hold a `File` and check type and size; the form's `send` puts it in a multipart body.

## Options that load

A select whose options come from the server (the queues of the chosen category, the models of a make) takes a `useOptions` where it takes a list. The state is typed (`idle`, `loading`, `loaded`, `failed`) and the field does the rest.

<!-- example: docs/examples/forms/components/RoutingFields.vue:10-12 -->
```ts
// The queues load from the category: the latest category wins, and a queue the new category does not have is cleared.
const categories = useOptions({ load: ({ signal }) => api.categories(signal) });
const queues = useOptions({ for: () => form.values.category, load: (category, { signal }) => api.queues(category, signal) });
```

<!-- example: docs/examples/forms/components/RoutingFields.vue:17-18 -->
```vue
    <SelectField v-bind="form.bind('category')" :label="t('forms.category')" :options="categories" />
    <SelectField v-bind="form.bind('queue')" :label="t('forms.queue')" :options="queues" :disabled="form.values.category === null" />
```

- `for` is a getter of the input the options depend on. `null` or `undefined` asks nothing (the list is empty, `idle`: also set `:disabled`); any other value asks, again whenever it changes. Without `for` the options load once.
- **Latest input wins.** An answer for an older input is ignored, even if it arrives last, and its request is aborted through the `signal` you pass on to `fetch`/the client. This is the same rule as suggestions while typing (`ComboField`), from the same code.
- **While it loads** the field stays visible with its label and its value and shows a small spinner in place of the arrows (`aria-busy`). Opened, the list says "Loading…". On a phone the sheet shows the same.
- **When it fails** the list says the options could not be loaded and has a "Try again" row (`options.reload()`).
- **A value the options of another input do not contain is cleared** (the field emits `null`, or for `MultiSelectField` drops the missing values), so a queue never stays selected for a category that does not have it. It happens only when options land after the input changed (the user picked another category). The first load never clears and neither does a reload of the same input: a record's saved queue that the list no longer offers (an inactive one) stays selected, and saving does not silently change it.
- **The label of a saved value** comes with `:selected` (the same prop as `ComboField`: an option, or an array of them for `MultiSelectField`): `<SelectField :options="queues" :selected="{ value: ticket.queueId, label: ticket.queueName }" />`. The field shows it while the options load and when they do not contain the value; without it a value the options do not know shows "Choose…" (but is kept). An option in the answer wins over `selected`.
- A select of a few options that load once and are shared by several fields can pass the same `useOptions` to each.
- Searching a long list is `ComboField :search`, not a select.

The desktop list is a popover that is never clipped by a dialog or a scrolling panel, and is at least as wide as the field (never narrower than its own minimum). Phones get the bottom sheet.

### Numbers without a thousands separator

A year, a code or a coordinate is a number that must not read "2.024". `:grouping="false"` writes none, shown or typed, and then a `.` or `,` the user types is always the decimal mark (with grouping on, `1.000` in Croatian is a thousand).

<!-- example: docs/examples/forms/components/RoutingFields.vue:19-20 -->
```vue
    <NumberField v-bind="form.bind('latitude')" :label="t('forms.latitude')" :decimals="6" negative :grouping="false" />
    <NumberField v-bind="form.bind('longitude')" :label="t('forms.longitude')" :decimals="6" negative :grouping="false" />
```

### Codes of a fixed length

`:max-digits="5"` is `maxlength` for a number: the most digits the field takes (the fraction's included; the sign, separators and decimal mark are not counted). A sixth digit typed does nothing; pasting a longer number keeps its first five. A postal code is `:grouping="false" :max-digits="5"`.

<!-- example: docs/examples/forms/views/Section.vue:29-29 -->
```vue
      <NumberField v-bind="form.bind('postalCode')" :label="t('forms.postalCode')" :grouping="false" :max-digits="5" />
```

## A section edited in place

A settings-style section (a dealer's record sections) edits where it reads, with no sheet and no Cancel. `useSaveChrome` puts Save in the page chrome, disabled while there is nothing to save; `cancel` is optional (without it there is no Cancel, and leaving with edits is still guarded). A page that *creates* passes `disabledWhileClean: false` so an untouched form can be submitted to learn what is missing (`EditorPage` does). `useHiddenFieldErrors({ form })` lists the errors whose field is not on screen, the same list `FormErrors` shows, for a toast of your own; read it after `await nextTick()` once a submit has refused.

<!-- example: docs/examples/forms/views/Section.vue:10-20 -->
```ts
const form = useForm({ defaults: () => ({ name: "", title: 1 as 1 | 2 | 3, postalCode: null as number | null, brands: [] as string[] }) });
const hidden = useHiddenFieldErrors({ form });

async function save() {
  const result = await form.submit(async () => undefined);
  await nextTick(); // the errors whose field is not on screen are worked out after the render
  if (result.status === "failed" && hidden.value.length) toast.error(hidden.value.map((each) => `${each.field}: ${each.message}`).join("; "));
}

// A section edited in place: Save is disabled until something changed, and there is no Cancel (leaving is guarded anyway).
useSaveChrome({ form, save });
```

<!-- example: docs/examples/forms/views/Section.vue:24-33 -->
```vue
  <FormView :form="form" @submit="save">
    <FormGroup :header="t('forms.vehicles')">
      <TextField v-bind="form.bind('name')" :label="t('forms.name')" />
      <!-- Not clearable: it emits 1 | 2 | 3, never null, so the draft says so. -->
      <SelectField v-bind="form.bind('title')" :label="t('forms.title')" :options="titles" />
      <NumberField v-bind="form.bind('postalCode')" :label="t('forms.postalCode')" :grouping="false" :max-digits="5" />
      <!-- The group's header says what the chips are; the label stays their accessible name. -->
      <ChoiceChips v-bind="form.bind('brands')" :label="t('forms.brands')" label-hidden :options="brands" />
    </FormGroup>
  </FormView>
```

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

## Phone numbers

`PhoneField` is in its own subpath, `@wssto2/vue-core/phone`, because it brings the phone metadata of libphonenumber-js (about 225 kB minified, 55 kB compressed, with the mobile / landline data): an app without phone fields does not download it. It is a country picker with the flag and dial code (common countries first, then all, searchable by name or dial code) and a number that is formatted as it is typed. The value is a string in E.164, `+38591234567`, or `""`.

<!-- example: docs/examples/forms/components/ContactFields.vue:35-36 -->
```vue
    <PhoneField v-bind="form.bind('mobile')" :label="t('forms.mobile')" />
    <PhoneField v-bind="form.bind('landline')" :label="t('forms.landline')" default-country="BA" />
```

- A number typed without a dial code belongs to the shown country (`091 234 5678` and `91 234 5678` are the same), a number pasted with a plus or `00` switches the country (`+387 61 234 567` makes it Bosnia and Herzegovina), and changing the country in the picker keeps the digits.
- When the user leaves the field it says what is wrong ("The number is too short for Bosnia & Herzegovina.", too long, not valid for the country) and, when the metadata can tell, what the number is (mobile, landline, toll-free). A number the field cannot place (a US number may be either) says nothing.
- The field reports; only a validator stops the save. `isValidPhone(value)` and `phoneProblem(value)` (the reason and the country) are the same check, for the form's schema; `phoneKind(value)` says mobile or landline, for a rule such as "a mobile number is required".

<!-- example: docs/examples/forms/components/ContactFields.vue:24-25 -->
```ts
      // The phone field says what is wrong once it is left; only a validator stops the save.
      for (const field of ["mobile", "landline"] as const) if (!isValidPhone(values[field])) issues.push({ path: [field], message: t("forms.badPhone") });
```

The default country is the field's `default-country`, else what the app provides once, else Croatia; the same place says which countries the picker lists first:

<!-- example: docs/examples/forms/environment.ts:5-9 -->
```ts
/** Once, in the composition root: what the app says about its phone numbers and, if not the browser's `localStorage`, where recent choices are kept. */
export function installFieldDefaults(app: App, recents?: RecentChoices) {
  app.provide(phoneDefaultsKey, { defaultCountry: "HR", commonCountries: ["HR", "BA", "SI", "RS", "AT", "DE"] });
  if (recents) app.provide(recentChoicesKey, recents);
}
```

A stored value that is not E.164 (legacy data such as `091 234 5678`) is read as a number of the default country and is not rewritten until the user edits it. Country names come from the browser (`Intl.DisplayNames`) in the app's language; the flags are SVGs, loaded one by one when they scroll into view (Windows draws emoji flags as two letters).

Read mode shows the number in international form with Call (`tel:`), Message (`sms:`) and Copy. WhatsApp and the like are the app's own actions, in the `actions` slot:

<!-- example: docs/examples/forms/components/PhoneRead.vue:8-15 -->
```vue
<template>
  <FormGroup :editable="false">
    <PhoneField :model-value="mobile" label="Mobile">
      <!-- Call, Message and Copy come with the field; WhatsApp is the app's own action. -->
      <template #actions="{ number }"><a :href="`https://wa.me/${number.slice(1)}`" class="rounded-full bg-tint-soft px-3 py-1.5 text-footnote text-content-link">WhatsApp</a></template>
    </PhoneField>
  </FormGroup>
</template>
```

## Suggestions

One engine suggests while typing, in two fields. `TextField :suggestions` keeps the value free text (a `string`: the user may ignore every suggestion); `ComboField` picks a record and keeps its id type. Both take a minimum length, a debounce and a limit, and neither does a request itself: the source is a function from the feature's `api.ts`.

<!-- example: docs/examples/forms/components/ContactFields.vue:37-38 -->
```vue
    <TextField v-bind="form.bind('city')" :label="t('forms.city')" :suggestions="(query, { signal }) => props.api.cities(query, signal)" recents="city" />
    <ComboField v-bind="form.bind('assignee')" :label="t('forms.assignee')" :search="(query, { signal }) => props.api.users(query, signal)" recents="assignee" />
```

- A suggestion is a string, or `{ text, detail }` (the detail is the second line of the row: "Croatia · 10 000"). A list is filtered as the user types, the best matches (those that start with the text) first; a function is asked after `suggestions-debounce` ms (default 300) once the text has `suggestions-min-length` characters (default 2), the older request is aborted and an answer for older text is dropped.
- The best match shows grey after the typed text and **Tab** accepts it; the list marks the matched part. Down and Up move, Enter picks a row the user moved to (a first suggestion nobody moved to does not steal Enter: in a pick-only `ComboField` it does), Escape closes without closing the dialog around it. A pick keeps the focus. The list says when it is loading or failed; a free-text field says nothing when nothing matches (a new street is not an error), a `ComboField` says "No matches".
- `recents="city"` lists the last five picks under "Recent" before the user types, kept per id. The default store is `localStorage` (a refusing or full store is ignored); an app that keeps them elsewhere provides a `RecentChoices` (`read(id)`, `write(id, choices)`) under `recentChoicesKey`, once.

<!-- example: docs/examples/forms/environment.ts:11-15 -->
```ts
/** An adapter that keeps recent choices in memory (for tests, or a store the app fills from its own settings). */
export function memoryRecents(): RecentChoices {
  const kept = new Map<string, readonly SelectOption<string | number>[]>();
  return { read: (id) => kept.get(id) ?? [], write: (id, choices) => void kept.set(id, choices) };
}
```

A free-text field with suggestions is left-aligned on phones, where other fields right-align their value: the grey completion needs the text to start at one edge. `TextField` emits `picked` with the `{ text, detail }` chosen, for filling a postcode from the city.

## Text in several languages

`I18nField` edits one text in each language of the app: the title of an advert, a product name. The value is `Record<locale, string>` (`{ hr: "Naslov", en: "Title" }`, `""` is not written yet); a locale the field does not list is kept as it is.

<!-- example: docs/examples/forms/components/ContactFields.vue:39-39 -->
```vue
    <I18nField v-bind="form.bind('title')" :label="t('forms.title')" :required-locales="['hr']" />
```

- A segment per language sits next to the label, a dot on it says whether that language is written. The languages are the app's (`createApplication`'s `locale.supported`) unless `locales` says otherwise; the first (or `default-locale`) is the one **Copy HR into empty ones** copies from. It opens in the app's current language. `multiline` is the textarea variant.
- `required-locales` says which languages must be written. Leaving the field while one is empty says so under it ("Required in Croatian."), whichever tab is open; a language that is not required but empty is a gentle line ("Not written yet: English."). `missingLocales(value, ['hr'])` is the same check for the schema, as in the form above.
- Reading shows the current language (or the default's, or the first written) with its code in the label (`Title · HR`) and "3 more languages · 1 written" under it, which opens the others.

## Testing

`useForm`, `useResourceForm`, `useGroupSheet` and `useCommand` need a component to live in and the library's i18n; the playground-free pattern used by this repo's own tests is a `createApp` with `createI18n`, the formatting plugin and an app-provided leave guard (see `src/form/testing.ts`).
