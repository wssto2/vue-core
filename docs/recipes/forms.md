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

One `Field` (label, hint, error, required, locked) around each control. `TextField`, `TextareaField`, `NumberField`, `MoneyField`, `SelectField`, `MultiSelectField`, `ComboField`, `SegmentedField`, `ChoiceChips`, `CardSelectField`, `SwitchField`, `CheckboxField`, `DateField`, `DateTimeField`, `MonthYearField`, `FileField`, `PhotoField`, `I18nField`, `PhoneField` (its own subpath, below), and `OtpInput`; `Field` itself for a control of your own.

- A field's value type is honest: text is `string` (`""` is empty), a number is `number | null`, a day is `"2026-09-30"` (never a `Date`), a switch is a boolean, a choice is its option's `value` or `null`. Mapping a nullable column, a 0/1 flag or an instant to these is the record mapping's job.
- **Read mode is the form's or the group's** (`FormView :editable`, `FormGroup :editable`): rows become value rows and empty ones disappear. **Locked is the field's** `disabled`: dimmed on wide screens, a value row on phones; the group's `locked-footer` says why once.
- Dates use the browser's own controls (no calendar dependency); the typed `Date` of a calendar widget is not offered.
- The upload is the app's: `FileField` and `PhotoField` hold a `File` and check type and size; the form's `send` puts it in a multipart body.

## Phone numbers

`PhoneField` is in its own subpath, `@wssto2/vue-core/phone`, because it brings the phone metadata of libphonenumber-js (about 150 kB before compression): an app without phone fields does not download it. It is a country picker with the flag and dial code (common countries first, then all, searchable by name or dial code) and a number that is formatted as it is typed. The value is a string in E.164, `+38591234567`, or `""`.

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
