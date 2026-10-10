<script setup lang="ts">
import { Button } from "@wssto2/vue-core/button";
import { Avatar, KeyValueList, MicroLabel, Panel, Timestamp, Divider } from "@wssto2/vue-core/content";
import { DateButton, IconTile, PopupButton, SearchInput, SwipeActions, Tabs, type TabItem } from "@wssto2/vue-core/controls";
import { Icon } from "@wssto2/vue-core/icon";
import { DiscardChangesModal, Modal, Sheet } from "@wssto2/vue-core/modal";
import { AlertDialog, Menu, Popover, Toaster, Tooltip, toast, type MenuItem } from "@wssto2/vue-core/overlay";
import { AdaptivePageShell, BottomDock, RecordHeader, ResourceHeader, type PageAction } from "@wssto2/vue-core/page";
import {
  AsyncSection,
  Badge,
  HUES,
  Banner,
  EmptyState,
  FieldNote,
  ProgressTrack,
  StatusLine,
  type AsyncState,
} from "@wssto2/vue-core/state";
import { ref, useTemplateRef } from "vue";
import LocalePanel from "./LocalePanel.vue";

const modal = useTemplateRef<InstanceType<typeof Modal>>("modal");
const sheet = useTemplateRef<InstanceType<typeof Sheet>>("sheet");
const alert = useTemplateRef<{ present: (row?: { id: number }) => void }>("alert");
const discard = useTemplateRef<{ present: () => void }>("discard");

const saving = ref<"idle" | "processing" | "done">("idle");
async function save() {
  saving.value = "processing";
  await new Promise((resolve) => setTimeout(resolve, 900));
  saving.value = "done";
  await new Promise((resolve) => setTimeout(resolve, 600));
  await modal.value?.dismiss();
  saving.value = "idle";
  toast.success("Saved", { action: { label: "Undo", onClick: () => toast.info("Undone") } });
}

const removed = ref<number | null>(null);
async function remove(row: { id: number }) {
  await new Promise((resolve) => setTimeout(resolve, 700));
  removed.value = row.id;
}

const tabs: TabItem<string>[] = [
  { value: "overview", label: "Overview", icon: "carLine" },
  { value: "notes", label: "Notes", badge: 3 },
  { value: "files", label: "Files", warning: "Documents are missing" },
];
const tab = ref("overview");

const menu: MenuItem[] = [
  { id: "copy", label: "Copy link", icon: "fileTextLine", shortcut: "⌘C", onSelect: () => toast.success("Copied") },
  { id: "call", label: "Call", icon: "phoneLine", onSelect: () => toast.info("Calling…") },
  { id: "split", label: "Split", checked: true, onSelect: () => toast.info("Split") },
  { id: "zagreb", label: "Zagreb", checked: false, onSelect: () => toast.info("Zagreb") },
  { id: "delete", label: "Delete", tone: "critical", onSelect: () => alert.value?.present({ id: 1 }) },
];

const listState = ref<AsyncState<string[]>>({ status: "loaded", value: ["Clio", "Megane", "Captur"] });
const listStates: Array<[string, AsyncState<string[]>]> = [
  ["loading", { status: "loading" }],
  ["loaded", { status: "loaded", value: ["Clio", "Megane", "Captur"] }],
  ["empty", { status: "loaded", value: [] }],
  ["refreshing", { status: "refreshing", value: ["Clio", "Megane"] }],
  ["stale", { status: "stale", value: ["Clio", "Megane"], error: "Offline" }],
  ["failed", { status: "failed", error: "The server did not answer." }],
];

const actions: PageAction[] = [
  { id: "edit", label: "Edit", placement: "primary", prominence: "standard", onClick: () => toast.info("Edit") },
  { id: "mail", label: "E-mail", icon: "mailLine", onClick: () => toast.info("E-mail") },
  { id: "delete", label: "Delete", tone: "critical", onClick: () => alert.value?.present({ id: 1 }) },
];

const search = ref("");
const progress = ref(40);
const prominences = ["primary", "secondary", "standard", "plain", "link"] as const;
const tones = ["neutral", "info", "positive", "warning", "critical"] as const;
</script>

<template>
  <div class="flex flex-col gap-section-gap">
    <Toaster />

    <Panel title="Icons" icon="carLine" subtitle="the app's own and the library's">
      <div class="flex flex-wrap items-center gap-4 text-content-strong">
        <Icon name="carLine" :size="32" />
        <Icon name="phoneLine" :size="22" />
        <Icon name="close" :size="16" label="Close icon" />
        <Icon name="alertTriangle" class="text-status-warning-content" />
        <!-- @vue-expect-error an icon nobody registered is a type error -->
        <Icon name="noSuchIcon" />
      </div>
    </Panel>

    <Panel title="Buttons">
      <div class="flex flex-col gap-3">
        <div v-for="tone in [undefined, 'critical'] as const" :key="tone ?? 'default'" class="flex flex-wrap items-center gap-2">
          <Button v-for="prominence in prominences" :key="prominence" :prominence="prominence" :tone="tone">{{ prominence }}</Button>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Button prominence="primary" size="xs">xs</Button>
          <Button prominence="primary" size="sm">sm</Button>
          <Button prominence="primary" icon="carLine">md with icon</Button>
          <Button prominence="primary" size="lg" trailing-icon="phoneLine">lg</Button>
          <Button prominence="primary" processing>Processing</Button>
          <Button disabled>Disabled</Button>
          <Button to="/record" prominence="secondary">A link</Button>
        </div>
      </div>
    </Panel>

    <Panel title="Controls">
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center gap-3">
          <IconTile tone="brand" icon="carLine" />
          <IconTile tone="anchor" text="N" size="md" />
          <IconTile tone="neutral" icon="fileTextLine" size="lg" />
          <PopupButton>Split</PopupButton>
          <PopupButton variant="plain" placeholder="Choose" />
          <DateButton>14. 3. 1984.</DateButton>
          <DateButton expanded>Picking…</DateButton>
        </div>
        <Tabs v-model="tab" :tabs="tabs" label="Sections">
          <p class="text-subheadline text-content-muted">Panel for {{ tab }}</p>
        </Tabs>
        <Tabs v-model="tab" :tabs="tabs" presentation="scope" />
        <SearchInput v-model="search" label="Search" placeholder="Search everything…" class="rounded-control bg-fill px-3 py-1.5" />
        <div class="overflow-hidden rounded-group shadow-group">
          <SwipeActions :actions="[{ key: 'call', label: 'Call', icon: 'phoneLine', href: 'tel:+38512345', tone: 'positive' }]" content-class="px-4 py-3">
            <span class="text-body text-content-strong">Swipe this row on a touch screen</span>
          </SwipeActions>
        </div>
      </div>
    </Panel>

    <Panel title="State">
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap gap-2">
          <Badge v-for="tone in tones" :key="tone" :tone="tone" dot>{{ tone }}</Badge>
          <Badge tone="context" dot>context</Badge>
        </div>
        <div class="flex flex-wrap gap-2"><Badge v-for="hue in HUES" :key="hue" :hue="hue">{{ hue }}</Badge></div>
        <div class="flex flex-wrap gap-2"><Badge v-for="hue in HUES" :key="hue" :hue="hue" appearance="dot">{{ hue }}</Badge></div>
        <Banner v-for="tone in tones" :key="tone" :tone="tone">A {{ tone }} banner, announced to match.</Banner>
        <FieldNote tone="warning">A note under one field.</FieldNote>
        <EmptyState title="No leads yet" description="Add the first one." icon="fileTextLine">
          <template #actions><Button prominence="primary" size="sm">Add a lead</Button></template>
        </EmptyState>
        <div class="flex flex-wrap gap-1.5">
          <Button v-for="[name, state] in listStates" :key="name" size="xs" prominence="secondary" @click="listState = state">{{ name }}</Button>
        </div>
        <AsyncSection :state="listState" empty-title="No cars" @retry="listState = listStates[1]![1]">
          <template #default="{ value }"><p class="text-body text-content-strong">{{ value.join(", ") }}</p></template>
        </AsyncSection>
        <StatusLine text="Searching the catalogue…" :elapsed="7" />
        <StatusLine text="3 matches" done />
        <ProgressTrack :value="progress" label="Search progress" />
        <Button size="xs" @click="progress = Math.min(progress + 25, 100)">Advance</Button>
      </div>
    </Panel>

    <LocalePanel />

    <Panel title="Content" collapsible>
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-3"><Avatar name="Josip Žlimen" size="md" /><Avatar name="Ana Horvat" size="lg" tone="anchor" /><MicroLabel>Status</MicroLabel></div>
        <KeyValueList :columns="3" :items="[{ key: 'make', label: 'Make', value: 'Renault' }, { key: 'vin', label: 'VIN', value: null }, { key: 'km', label: 'Km', value: 0 }]" />
        <Timestamp value="2026-09-30T14:05:00Z" />
        <Divider label="or enter it manually" />
      </div>
    </Panel>

    <Panel title="Overlays">
      <div class="flex flex-wrap items-center gap-2">
        <Button prominence="primary" @click="modal?.present()">Modal</Button>
        <Button @click="sheet?.present()">Sheet</Button>
        <Button tone="critical" @click="alert?.present({ id: 7 })">Alert</Button>
        <Button @click="discard?.present()">Discard changes</Button>
        <Menu :items="menu" label="Actions">
          <template #trigger="{ toggle, attrs }"><Button v-bind="attrs" trailing-icon="arrowDownSLine" @click="toggle">Menu</Button></template>
        </Menu>
        <Popover label="Quick note" placement="bottom-start">
          <template #trigger="{ toggle, attrs }"><Button v-bind="attrs" @click="toggle">Popover</Button></template>
          <template #default="{ dismiss }">
            <div class="flex flex-col gap-2"><input class="rounded-control bg-fill px-2 py-1" aria-label="Note" /><Button size="sm" prominence="primary" @click="dismiss">Done</Button></div>
          </template>
        </Popover>
        <Tooltip text="Copy the VIN"><Button prominence="plain" icon="fileTextLine">Hover me</Button></Tooltip>
        <Button @click="toast.error('Could not save', { action: { label: 'Retry', onClick: () => {} } })">Toast</Button>
        <Button @click="toast.info('Filter deleted', { action: { label: 'Undo', onClick: () => {} } })">Info toast</Button>
        <Button @click="toast.message('Filter deleted', { action: { label: 'Undo', onClick: () => {} }, onDismiss: () => {} })">Plain toast</Button>
      </div>
      <p v-if="removed" class="mt-3 text-footnote text-content-muted">Deleted {{ removed }}</p>
      <Modal ref="modal" title="New lead" subtitle="Step 1 of 1" size="md" grouped primary-label="Create" :status="saving" processing-label="Saving…" done-label="Saved" @primary="save">
        <p class="text-body text-content-strong">Dialog on wide screens, a page sheet on phones.</p>
      </Modal>
      <Sheet ref="sheet" title="Filters" grouped><p class="text-body text-content-strong">A slide-over, or a bottom sheet on touch.</p></Sheet>
      <AlertDialog ref="alert" tone="critical" title="Delete record" message="This cannot be undone." confirm-label="Delete" :action="remove" />
      <DiscardChangesModal ref="discard" />
    </Panel>

    <div class="overflow-hidden rounded-group shadow-group">
      <AdaptivePageShell title="Ivan Horvat" :back="{ label: 'Customers', to: '/' }" :actions="actions" width="content">
        <template #header>
          <RecordHeader title="Ivan Horvat" subtitle="Private person · Sarajevo" :quick-actions="[{ id: 'call', label: 'Call', icon: 'phoneLine', href: 'tel:+38512345' }]">
            <template #leading><Avatar name="Ivan Horvat" size="xl" tone="anchor" /></template>
            <template #meta><Badge tone="positive" dot>Active</Badge><span>Sarajevo</span></template>
          </RecordHeader>
        </template>
        <ResourceHeader title="Notes" :count="1248" icon="fileTextLine" inline-actions :actions="[{ id: 'new', label: 'New note', placement: 'primary', onClick: () => {} }]" />
      </AdaptivePageShell>
    </div>

    <BottomDock />
  </div>
</template>
