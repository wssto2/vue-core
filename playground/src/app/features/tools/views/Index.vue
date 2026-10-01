<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { ApiError, type ApiErrorKind } from "@wssto2/vue-core/client";
import { useDescribeError } from "@wssto2/vue-core/i18n";
import { Modal, ShortcutHelp } from "@wssto2/vue-core/modal";
import type { ModalPlacement } from "@wssto2/vue-core/modal";
import { useOpenDialogCount } from "@wssto2/vue-core/overlay";
import { AdaptivePageShell } from "@wssto2/vue-core/page";
import { AccessGate } from "@wssto2/vue-core/platform";
import { AsyncSection, Badge, HUES, useLoad } from "@wssto2/vue-core/state";
import { computed, ref, useTemplateRef } from "vue";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

// --- describeError: one sentence per kind of failure, in the app's language (switch it in the account menu).
const describeError = useDescribeError();
const kinds: { kind: ApiErrorKind; status: number | null; code?: string; params?: Record<string, unknown> }[] = [
  { kind: "unauthorized", status: 401 },
  { kind: "forbidden", status: 403 },
  { kind: "notFound", status: 404 },
  { kind: "conflict", status: 409 },
  { kind: "validation", status: 422 },
  { kind: "rejected", status: 429 },
  { kind: "server", status: 500 },
  { kind: "network", status: null },
  { kind: "aborted", status: null },
];
const sentence = (kind: (typeof kinds)[number]) =>
  describeError(new ApiError({ kind: kind.kind, status: kind.status, message: "log text", fields: kind.kind === "validation" ? { name: ["required"] } : {} }), { fallback: "The changes could not be saved." });

// --- useLoad: a list with no identity; reload keeps it on screen, update() is a local write.
let calls = 0;
const failNext = ref(false);
const settings = useLoad(async ({ signal }) => {
  const call = ++calls;
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (signal.aborted) throw new DOMException("aborted", "AbortError");
  if (failNext.value) {
    failNext.value = false;
    throw new ApiError({ kind: "server", status: 500, message: "boom" });
  }
  return [`Load number ${call}`, "Second row"];
});

// --- framed-app hooks: how many dialogs are open, and where a Modal stands.
const dialogs = useOpenDialogCount();
const modal = useTemplateRef<InstanceType<typeof Modal>>("modal");
const top = ref(false);
const offset = ref(false);
const placement = computed<ModalPlacement>(() => ({ align: top.value ? "top" : "center", offsetX: offset.value ? -120 : 0 }));
</script>

<template>
  <AdaptivePageShell :title="t('tools.title')" description="The small tools: access gate, error sentences, one load, shortcuts help, framed-app hooks, category hues." width="content">
    <section class="flex flex-col gap-3">
      <h2 class="text-headline font-semibold">Category hues</h2>
      <div class="flex flex-wrap gap-2"><Badge v-for="hue in HUES" :key="hue" :hue="hue">{{ hue }}</Badge></div>
      <div class="flex flex-wrap gap-2"><Badge v-for="hue in HUES" :key="hue" :hue="hue" appearance="dot">{{ hue }}</Badge></div>
      <p class="text-footnote text-content-muted">Tinted and dot styles; the theme switch is in the account menu. Statuses stay separate: <Badge tone="critical" dot>critical</Badge> <Badge tone="positive" dot>positive</Badge></p>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-headline font-semibold">Access gate</h2>
      <AccessGate permission="tickets:view">
        <Badge tone="positive" dot>Shown: the user holds tickets:view</Badge>
      </AccessGate>
      <AccessGate permission="records:audit">
        <Badge tone="positive" dot>Hidden: the user does not hold records:audit</Badge>
        <template #fallback><Badge tone="neutral" dot>Fallback: records:audit is not held</Badge></template>
      </AccessGate>
      <AccessGate :any="['records:audit', 'reports:view']"><Badge tone="positive" dot>any of: one is held</Badge></AccessGate>
      <AccessGate :all="['records:audit', 'reports:view']"><Badge tone="positive" dot>never shown: all of</Badge></AccessGate>
    </section>

    <section class="flex flex-col gap-2">
      <h2 class="text-headline font-semibold">describeError</h2>
      <p v-for="kind in kinds" :key="kind.kind" class="text-body"><span class="inline-block w-28 text-content-muted">{{ kind.status ?? kind.kind }} {{ kind.kind }}</span>{{ sentence(kind) }}</p>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-headline font-semibold">useLoad</h2>
      <AsyncSection :state="settings.state.value" @retry="settings.reload()">
        <template #default="{ value }"><ul class="list-disc pl-5"><li v-for="row in value" :key="row">{{ row }}</li></ul></template>
      </AsyncSection>
      <div class="flex flex-wrap gap-2">
        <Button size="sm" @click="settings.reload()">Reload</Button>
        <Button size="sm" @click="failNext = true; settings.reload()">Reload and fail</Button>
        <Button size="sm" @click="settings.update(['Updated locally', 'a reload in flight is dropped'])">update(value)</Button>
      </div>
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-headline font-semibold">Shortcuts</h2>
      <p class="text-body">Press <kbd class="rounded-control bg-fill px-1.5">?</kbd> for the list (this page registers nothing itself; the record pager and list keys list their own on their pages).</p>
      <ShortcutHelp />
    </section>

    <section class="flex flex-col gap-3">
      <h2 class="text-headline font-semibold">Framed-app hooks</h2>
      <p class="text-body">Open dialogs: <strong>{{ dialogs }}</strong></p>
      <label class="flex items-center gap-2"><input v-model="top" type="checkbox" /> top-aligned</label>
      <label class="flex items-center gap-2"><input v-model="offset" type="checkbox" /> shifted 120 px left</label>
      <div><Button prominence="primary" @click="modal?.present()">Open a modal</Button></div>
      <Modal ref="modal" title="Placement" size="sm" :placement="placement"><p>Wide screens only; phones keep the page sheet.</p></Modal>
    </section>
  </AdaptivePageShell>
</template>
