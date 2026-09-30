# Forms

`@wssto2/vue-core/form` has three compositions, one per user task. Pick by the task, not by the widget.

| The user… | Compose | Who saves |
|---|---|---|
| changes **one group of a record** | `FormGroup` + `GroupSheet` + `useGroupSheet` | the sheet, one save, the page has none |
| **creates** a record, or edits a justified long form | `EditorPage` + `useForm` (or `useResourceForm`) | the page, one coordinated submit in the page chrome |
| **advances, reassigns, approves, re-prices** | `useCommand` + `CommandDialog` (or `AlertDialog`) | one purpose-specific call with its own confirmation |

A screen with group sheets has no global Save. A command is never a field autosave.

The working examples are in `playground/src/app/features/forms/` (an account record in group sheets, an offer editor, a status command, over a fake backend that answers 422 and 409).

## Once per application

Mount the leave guard so "Unsaved changes" is asked in one place:

```ts
const application = createApplication({ … });
installLeaveGuard(application.app);      // or a feature's `context: provideContext(leaveGuardKey, createLeaveGuard())`
```
```vue
<!-- the shell, once, like <Toaster /> -->
<LeaveGuardRoot />
```

The app's validator is whatever has Zod's `safeParse` shape (Zod 3 and 4, or a hand-written object). The library does not depend on Zod.

## Form state

```ts
const form = useForm({
  defaults: () => ({ subject: "", priority: null as number | null, tags: [] as string[] }),   // the draft: what fields edit
  validator: ticketSchema,                                                                     // its output is the payload
  translate: (message) => t(message),                                                          // server codes into sentences
  serverField: camel,                                                                          // `due_on` is `dueOn` in the draft
});
```

```vue
<TextField v-bind="form.bind('subject')" :label="t('subject')" required />
<NumberField v-bind="form.bind('priority')" :label="t('priority')" />
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

```ts
const ticket = useRouteResource({ param: "ticketID", load: (id, { signal }) => api.get(id, { signal }) });
const form = useResourceForm({
  source: ticket,                                                 // hydrates from the page's record: no second request
  defaults: emptyTicket,
  validator: ticketSchema,
  toValues: (t) => ({ subject: t.subject, dueOn: t.due_on }),     // DTO to draft, explicit
  save: (payload, t, { idempotencyKey }) => api.update(t.id, body(payload, t)),   // the endpoint's body, stated here
});
```

It is filled once and again for another record; a record that changes under unsaved edits (a background reload) does not replace them (`form.outdated`; `reset()` takes the new one); a save puts the returned record in the resource once.

## 1. One group of a record (D22)

```ts
const groups = provideRecordGroups<"contact" | "address">({ edit: (group) => sheets[group].present });
const contact = useGroupSheet({ form, group: "contact", fields: ["email", "phone"], groupOf: groups.groupOf });
```
```vue
<FormView :editable="false">                               <!-- the page reads -->
  <FormGroup group="contact" :header="t('contact')">        <!-- Edit appears in its header -->
    <TextField v-bind="form.bind('email')" :label="t('email')" />
  </FormGroup>
</FormView>
<GroupSheet :sheet="contact" :title="t('contact')" :editable="canEdit" :group-label="groupLabel">
  <RecordGroupScope only="contact" :editable="canEdit"><ContactSections :form="form" /></RecordGroupScope>
</GroupSheet>
```

One markup serves the read page and every sheet: in its sheet only the group shows. Decisions the sheet makes explicit:

- **Transport.** By default it saves the record's **full update** (`form.save()`: the whole valid record with this group's changes). A group with an endpoint of its own says so: `save: (changes) => api.saveContact(id, changes)` receives exactly the group's fields, and the other fields are neither sent nor judged. The two are never inferred from each other.
- **Conflict.** A 409 is shown as the conflict it is, and nothing is retried. Only an endpoint that documents 409 as "your copy is stale" is rebased: `rebase: { reload: () => ticket.reload(), message: () => t("stale") }` re-reads the record, lays the user's *changed* fields back on top (an untouched field takes the new value), tells them, and waits for a deliberate second Save.
- **Foreign errors.** A failed save that complains about another group's field names that group at the top of the sheet; the error stays in the form, so that group's sheet shows it when opened. A field no group claims is listed (`fallbackGroup` names it).
- **Cancel** puts back only the group's fields (`restore` widens this for fields that derive from each other across groups), clears its errors, and a sheet with edits asks first. Focus returns to Edit.
- **Refresh.** `onSaved` re-reads what else depends on the record. If it fails the save still counts, the sheet closes and a toast says the record could not be read back.

## 2. A long form

```vue
<EditorPage :title="t('offers.create')" :back="backToOffers" :form="form" :save-label="t('offers.create')" @save="save">
  <SectionPanel :title="t('customer')" number="01" presentation="section">…fields…</SectionPanel>
  <SectionPanel :title="t('lines')" number="02" presentation="section" collapsible>…</SectionPanel>
  <template #aside><OfferSummary :totals="totals" /></template>
</EditorPage>
```
```ts
async function save() {
  const result = await form.submit((payload, { idempotencyKey }) => api.create(body(payload)));
  if (result.status === "saved") router.push(…);
}
```

With a `form` the page does the rest: Save in the page chrome with a spinner, "Unsaved changes" and Cancel, the leave guard, the failure banner, an error count and a check per section, a required-fields progress bar, and after a refused submit focus on the first error with its (collapsed) section opened. Derived values (totals) are plain `computed`s over `form.values` in the feature. A page of your own uses `useSaveChrome({ form, save, cancel })`.

## 3. A command

```ts
const assign = useCommand({
  defaults: () => ({ assignee: null as number | null, note: "" }),
  validator: assignSchema,
  run: (input, { idempotencyKey }) => api.assign(ticket.id.value!, input),
  done: (saved) => ticket.update(saved),
});
```
```vue
<Button @click="assign.present()">Assign…</Button>
<CommandDialog :command="assign" :title="t('assign')" :confirm-label="t('assign')">
  <FormGroup><ComboField v-bind="assign.form.bind('assignee')" :label="t('assignee')" :search="findUsers" /></FormGroup>
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
