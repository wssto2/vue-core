# Recipe: where a record stands

Five components in `@wssto2/vue-core/state` for a record that moves through phases. They show state and take no decision: the screen owns the wording, the permissions and what an action opens. Their fixed texts (`core.stepper.*`, `core.next_step.*`, `core.requirements.*`, `core.todo_state.*`, `core.phase_tiles.*`) are in the five core locales.

## `PhaseTrack`: the process, step by step

A horizontal track on a wide screen (done steps filled, the current one a ring in the tint or `currentTone`, later ones hollow); `orientation="vertical"` is the timeline card, and what a horizontal track becomes on a phone. With `compact-on-mobile`, below 1024px it is one row ("Step 2 of 4", a segmented bar) that opens the timeline in a sheet. `current-step` is 0-based; `steps.length` or more means all done, and `outcome="success" | "danger"` colours the last step then.

<!-- example: docs/examples/workflow/RecordProcess.vue:20-21 -->
```vue
  <!-- track -->
  <PhaseTrack :steps="steps" :current-step="1" :title="t('tickets.phase')" compact-on-mobile />
```

## `PhaseTiles`: the phases of a record

One tile per phase on a wide screen (a check or its number, the label, a one-line state under it); a card with a segmented bar on a narrow one, listing every phase in a sheet. Tiles are status: only a tile with `to` is a link.

<!-- example: docs/examples/workflow/RecordProcess.vue:22-23 -->
```vue
  <!-- tiles -->
  <PhaseTiles :label="t('tickets.phase')" :phases="phases" />
```

## `TodoRow`: one to-do

`state` is `done`, `missing`, `waiting` or `optional` (the mark, and what a screen reader hears). The row either drills in (`to`) or has one trailing `action`, never both; put rows in a `FormGroup`.

<!-- example: docs/examples/workflow/RecordProcess.vue:24-26 -->
```vue
  <!-- todo -->
  <TodoRow state="missing" label="Required data" sub="Missing: colour" :to="{ name: 'tickets.index' }" />
  <TodoRow state="missing" label="Checklist" :action="{ label: 'Fill in', onClick: () => undefined }" />
```

## `NextStepPanel`: what next

The next step's text and one primary action. A disabled action stays visible and says why under it (`reason`); `handoff` names the person who takes a step the user may not; `note` is a quiet line under a separator.

<!-- example: docs/examples/workflow/RecordProcess.vue:27-28 -->
```vue
  <!-- next -->
  <NextStepPanel body="The vehicle moves to Sale." :action="{ label: 'Move to sale…', disabled: true }" reason="Enter the colour first." :note="t('core.next_step.menu_hint', { action: 'Back to appraisal' })" />
```

## `RequirementList`: what a transition needs

One row per precondition; an unmet row has its hint and a link to the screen that fixes it. When every item is met it collapses to one row (`summary-when-met`, default `core.requirements.all_met`); an empty list is not "all met".

<!-- example: docs/examples/workflow/RecordProcess.vue:29-30 -->
```vue
  <!-- requirements -->
  <RequirementList :items="requirements" :title="t('tickets.missing')" summary-when-met="Ready to activate" />
```
